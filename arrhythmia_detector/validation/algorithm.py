"""Python reimplementation of arrhythmia_detector.ino's signal processing
and peak-detection pipeline, for offline validation against labeled ECG
data.

Pipeline: high-pass IIR -> low-pass IIR -> derivative -> squaring ->
moving-window integration -> canonical Pan-Tompkins adaptive thresholding
(SPKI/NPKI, THRESHOLD1/THRESHOLD2, search-back) with amplitude-ratio
rejection and T-wave slope discrimination layered on top.

IMPORTANT: earlier versions of this module classified a candidate peak at
the instant mwi first crossed THRESHOLD1 (the rising edge), using that
crossing-instant mwi value to update SPKI (peak_level). That value is
systematically smaller than the excursion's true local maximum (verified:
2.5x-6.3x smaller, growing over time on record 100), and since a smaller
SPKI lowers THRESHOLD1, which makes the next crossing happen even earlier,
this was an unstable positive-feedback loop that collapsed the threshold
toward the noise floor within ~90 seconds - independent of the amplitude
ratio bounds (confirmed identical collapse under both the original [0.35,
3.0] and widened [0.2, 5.0] settings). This version fixes that by only
classifying a peak once its excursion above THRESHOLD1 ends, using the
excursion's true local maximum - matching canonical Pan-Tompkins, where
PEAKI is always a real peak-picked local maximum, never a threshold-
crossing value.
"""

from collections import deque
from dataclasses import dataclass, field

SAMPLE_RATE_HZ = 250
SAMPLE_PERIOD_MS = 1000.0 / SAMPLE_RATE_HZ

HP_ALPHA = 0.995
LP_ALPHA = 0.3
MWI_WINDOW = 15

AMPLITUDE_RATIO_MIN = 0.2
AMPLITUDE_RATIO_MAX = 5.0

REFRACTORY_FLOOR_MS = 300
REFRACTORY_RR_FRACTION = 0.4

RR_MIN_MS = 400
RR_MAX_MS = 1500

WARMUP_SAMPLES = SAMPLE_RATE_HZ * 2  # ~2 sec, matches the .ino

# T-wave discrimination (Pan-Tompkins style): a candidate peak landing
# 200-360ms after the last confirmed R-peak could be a T-wave rather than
# a new QRS. Reject it unless its rate of rise is at least half the last
# confirmed R-peak's rate of rise. Not applied to search-back recoveries
# (they're far from the last confirmed peak by construction).
TWAVE_ZONE_MIN_MS = 200
TWAVE_ZONE_MAX_MS = 360
TWAVE_SLOPE_RATIO_MIN = 0.5

# Canonical Pan-Tompkins search-back: if no beat is confirmed within
# SEARCHBACK_RR_MULTIPLIER x the current average RR, re-examine that gap
# using THRESHOLD2 (= 0.5*THRESHOLD1) to recover a likely missed beat.
SEARCHBACK_RR_MULTIPLIER = 1.66
SEARCHBACK_HISTORY_MS = 4000  # rolling buffer depth for the re-examination


@dataclass
class DetectorState:
    hp_prev_input: float = 0.0
    hp_prev_output: float = 0.0
    lp_prev_output: float = 0.0
    deriv_prev1: float = 0.0

    mwi_buffer: list = field(default_factory=lambda: [0.0] * MWI_WINDOW)
    deriv_buffer: list = field(default_factory=lambda: [0.0] * MWI_WINDOW)
    mwi_index: int = 0
    mwi_sum: float = 0.0

    signal_threshold: float = 0.0  # THRESHOLD1 = NPKI + 0.25*(SPKI-NPKI)
    spki: float = 0.0              # running signal peak estimate
    npki: float = 0.0              # running noise peak estimate
    above_threshold: bool = False

    # Current excursion's true local maximum (peak-picked, not the
    # crossing-instant value) - this IS "PEAKI" once the excursion ends.
    excursion_peak_mwi: float = 0.0
    excursion_peak_time: float = 0.0
    excursion_peak_slope: float = 0.0

    last_peak_time: float = 0.0
    init_samples: int = 0
    initialized: bool = False

    avg_peak_amplitude: float = 0.0
    avg_peak_initialized: bool = False

    avg_rr: float = 0.0
    avg_rr_initialized: bool = False

    last_confirmed_slope: float = 0.0

    history: deque = field(default_factory=deque)  # (time_ms, mwi, slope)
    searchback_attempted: bool = False

    r_peak_times_ms: list = field(default_factory=list)


def process_sample(raw: float, now_ms: float, st: DetectorState,
                    hp_alpha=HP_ALPHA, lp_alpha=LP_ALPHA,
                    amp_ratio_min=AMPLITUDE_RATIO_MIN, amp_ratio_max=AMPLITUDE_RATIO_MAX,
                    twave_discrimination=True, searchback=True) -> None:
    x = float(raw)

    # 1. High-pass filter (baseline wander removal)
    hp_out = hp_alpha * (st.hp_prev_output + x - st.hp_prev_input)
    st.hp_prev_input = x
    st.hp_prev_output = hp_out

    # 2. Low-pass filter (noise smoothing)
    lp_out = lp_alpha * hp_out + (1 - lp_alpha) * st.lp_prev_output
    st.lp_prev_output = lp_out

    # 3. Derivative
    deriv = (lp_out - st.deriv_prev1) / 2.0
    st.deriv_prev1 = lp_out

    # 4. Squaring
    squared = deriv * deriv

    # 5. Moving window integration
    st.mwi_sum -= st.mwi_buffer[st.mwi_index]
    st.mwi_buffer[st.mwi_index] = squared
    st.mwi_sum += squared
    st.deriv_buffer[st.mwi_index] = deriv
    st.mwi_index = (st.mwi_index + 1) % MWI_WINDOW
    mwi = st.mwi_sum / MWI_WINDOW

    candidate_slope = max(abs(d) for d in st.deriv_buffer)

    if searchback:
        st.history.append((now_ms, mwi, candidate_slope))
        while st.history and now_ms - st.history[0][0] > SEARCHBACK_HISTORY_MS:
            st.history.popleft()

    detect_peak(mwi, candidate_slope, now_ms, st,
                amp_ratio_min=amp_ratio_min, amp_ratio_max=amp_ratio_max,
                twave_discrimination=twave_discrimination, searchback=searchback)


def detect_peak(mwi: float, candidate_slope: float, now_ms: float, st: DetectorState,
                 amp_ratio_min=AMPLITUDE_RATIO_MIN, amp_ratio_max=AMPLITUDE_RATIO_MAX,
                 twave_discrimination=True, searchback=True) -> None:
    if not st.initialized:
        st.spki = max(st.spki, mwi)
        st.npki = (st.npki * 0.99) + (mwi * 0.01)
        st.init_samples += 1
        if st.init_samples > WARMUP_SAMPLES:
            st.signal_threshold = st.npki + 0.25 * (st.spki - st.npki)
            st.initialized = True
        return

    if mwi > st.signal_threshold:
        if not st.above_threshold:
            st.above_threshold = True
            st.excursion_peak_mwi = mwi
            st.excursion_peak_time = now_ms
            st.excursion_peak_slope = candidate_slope
        elif mwi > st.excursion_peak_mwi:
            st.excursion_peak_mwi = mwi
            st.excursion_peak_time = now_ms
            st.excursion_peak_slope = candidate_slope
    else:
        if st.above_threshold:
            # Excursion just ended: classify using its TRUE peak, not the
            # (smaller, earlier) crossing-instant value.
            classify_candidate(st.excursion_peak_mwi, st.excursion_peak_slope,
                                st.excursion_peak_time, st,
                                amp_ratio_min, amp_ratio_max, twave_discrimination,
                                via_searchback=False)
            st.above_threshold = False
        st.npki = 0.125 * mwi + 0.875 * st.npki

    st.signal_threshold = st.npki + 0.25 * (st.spki - st.npki)

    if searchback and st.avg_rr_initialized and st.last_peak_time != 0 and not st.searchback_attempted:
        gap = now_ms - st.last_peak_time
        if gap > SEARCHBACK_RR_MULTIPLIER * st.avg_rr:
            do_searchback(now_ms, st, amp_ratio_min, amp_ratio_max)
            st.searchback_attempted = True


def do_searchback(now_ms: float, st: DetectorState,
                   amp_ratio_min=AMPLITUDE_RATIO_MIN, amp_ratio_max=AMPLITUDE_RATIO_MAX) -> None:
    threshold2 = 0.5 * st.signal_threshold
    candidates = [(t, m, s) for (t, m, s) in st.history
                  if st.last_peak_time < t <= now_ms and m > threshold2]
    if not candidates:
        return
    peak_time, peak_mwi, peak_slope = max(candidates, key=lambda item: item[1])
    classify_candidate(peak_mwi, peak_slope, peak_time, st,
                        amp_ratio_min, amp_ratio_max, twave_discrimination=False,
                        via_searchback=True)


def classify_candidate(peak_mwi: float, peak_slope: float, peak_time: float, st: DetectorState,
                        amp_ratio_min: float, amp_ratio_max: float, twave_discrimination: bool,
                        via_searchback: bool) -> None:
    refractory = REFRACTORY_FLOOR_MS
    if st.avg_rr_initialized:
        adaptive = st.avg_rr * REFRACTORY_RR_FRACTION
        if adaptive > refractory:
            refractory = adaptive

    if st.last_peak_time != 0 and peak_time - st.last_peak_time <= refractory:
        return

    amplitude_ok = True
    if st.avg_peak_initialized:
        ratio = peak_mwi / st.avg_peak_amplitude
        if ratio < amp_ratio_min or ratio > amp_ratio_max:
            amplitude_ok = False

    t_wave_suspect = False
    if twave_discrimination and not via_searchback and st.last_peak_time != 0:
        since_last_peak = peak_time - st.last_peak_time
        if TWAVE_ZONE_MIN_MS <= since_last_peak <= TWAVE_ZONE_MAX_MS:
            if peak_slope < TWAVE_SLOPE_RATIO_MIN * st.last_confirmed_slope:
                t_wave_suspect = True

    # SPKI update: canonical Pan-Tompkins uses a faster-adapting weight for
    # search-back recoveries (0.25/0.75) vs. normal detections (0.125/0.875).
    if via_searchback:
        st.spki = 0.25 * peak_mwi + 0.75 * st.spki
    else:
        st.spki = 0.125 * peak_mwi + 0.875 * st.spki

    if amplitude_ok and not t_wave_suspect:
        if not st.avg_peak_initialized:
            st.avg_peak_amplitude = peak_mwi
            st.avg_peak_initialized = True
        else:
            st.avg_peak_amplitude = 0.2 * peak_mwi + 0.8 * st.avg_peak_amplitude
        st.last_confirmed_slope = peak_slope
        register_r_peak(peak_time, st, bypass_rr_bounds=via_searchback)
        st.searchback_attempted = False


def register_r_peak(now_ms: float, st: DetectorState, bypass_rr_bounds: bool = False) -> None:
    if st.last_peak_time == 0:
        st.last_peak_time = now_ms
        return

    rr = now_ms - st.last_peak_time
    st.last_peak_time = now_ms

    if not bypass_rr_bounds and (rr < RR_MIN_MS or rr > RR_MAX_MS):
        return

    if not st.avg_rr_initialized:
        st.avg_rr = rr
        st.avg_rr_initialized = True
    else:
        st.avg_rr = 0.25 * rr + 0.75 * st.avg_rr

    st.r_peak_times_ms.append(now_ms)


RR_HISTORY_LEN = 8
MAD_THRESHOLD_MS = 90.0  # validated in variability_metric_test.py


def classify_rhythm(rr_history: list) -> tuple:
    """Python port of classifyRhythm() in arrhythmia_detector.ino,
    including the MAD-based (median absolute deviation) irregular-rhythm
    check that replaced population SDNN - see variability_metric_test.py
    for the validation. rr_history: the most recent RR intervals (ms), up
    to RR_HISTORY_LEN, oldest first - same as the .ino's rrHistory ring
    buffer contents. Returns (status: str, alert: bool).

    NOTE: this was not previously ported to Python - algorithm.py only
    ever mirrored R-peak detection, not rhythm classification. This is a
    new addition, not a re-sync of a prior port.
    """
    filled = len(rr_history)
    sorted_rr = sorted(rr_history)
    median_rr = sorted_rr[filled // 2]  # matches the .ino's coarser median (no averaging)

    mean_rr = sum(rr_history) / filled
    sq_diff_sum = sum((rr - mean_rr) ** 2 for rr in rr_history)
    sdnn = (sq_diff_sum / filled) ** 0.5  # kept for parity with the .ino's log line; unused below

    if filled % 2 == 0:
        true_median_rr = (sorted_rr[filled // 2 - 1] + sorted_rr[filled // 2]) / 2.0
    else:
        true_median_rr = sorted_rr[filled // 2]
    deviations = sorted(abs(rr - true_median_rr) for rr in rr_history)
    if filled % 2 == 0:
        mad = (deviations[filled // 2 - 1] + deviations[filled // 2]) / 2.0
    else:
        mad = deviations[filled // 2]

    median_bpm = 60000.0 / median_rr

    alert = False
    status = "Normal"

    if median_bpm > 100:
        status = "Tachycardia (HR > 100 bpm)"
        alert = True
    elif median_bpm < 60:
        status = "Bradycardia (HR < 60 bpm)"
        alert = True
    elif mad > MAD_THRESHOLD_MS:
        status = "Irregular rhythm (high RR variability, possible AFib)"
        alert = True

    last_rr = rr_history[-1]
    if last_rr > median_rr * 1.6:
        status = "Possible pause / dropped beat"
        alert = True

    return status, alert


def run_detector(samples, hp_alpha=HP_ALPHA, lp_alpha=LP_ALPHA,
                  amp_ratio_min=AMPLITUDE_RATIO_MIN, amp_ratio_max=AMPLITUDE_RATIO_MAX,
                  twave_discrimination=True, searchback=True) -> list:
    """samples: iterable of ADC-like values sampled at SAMPLE_RATE_HZ.
    Returns list of detected R-peak timestamps in ms.

    Keyword args default to the current best-known configuration
    (amplitude ratio 0.2-5.0, T-wave discrimination on, search-back on);
    pass overrides to test configurations without touching the defaults."""
    st = DetectorState()
    for i, raw in enumerate(samples):
        now_ms = i * SAMPLE_PERIOD_MS
        process_sample(raw, now_ms, st, hp_alpha=hp_alpha, lp_alpha=lp_alpha,
                        amp_ratio_min=amp_ratio_min, amp_ratio_max=amp_ratio_max,
                        twave_discrimination=twave_discrimination, searchback=searchback)
    return st.r_peak_times_ms
