#!/usr/bin/env python3
"""Test whether a successive-difference sign-change-rate check can tell
"smoothly cyclical" RR variability (respiratory sinus arrhythmia during
normal sinus rhythm) apart from "erratic" RR variability (real AFib/AFL),
both of which can produce SDNN > 150ms under the current classifyRhythm()
rule in arrhythmia_detector.ino.

Ground truth comes from MIT-BIH Arrhythmia Database rhythm annotations
(the '+' aux_note spans, e.g. "(AFIB", "(N") - NOT from the detector
itself, so this measures the classifier logic against real physician
labels, independent of any R-peak detection error.

For each record: build (beat_time_ms, rhythm_label) pairs, restricted to
actual beat annotations. Slide an 8-beat window (matching the .ino's
RR_HISTORY_LEN) over beats that fall in a single homogeneous rhythm span
(no window straddles a rhythm transition). For each window compute:
  - medianRR/SDNN exactly as classifyRhythm() does
  - sign-change rate of the 7 successive RR differences

Then compare, for AFIB/AFL-labeled windows vs N-labeled windows:
  - BEFORE: flag rate under the current rule (SDNN > 150)
  - AFTER:  flag rate under SDNN > 150 AND sign-change-rate >= threshold
"""

import statistics
from pathlib import Path

import wfdb

DATA_DIR = Path(__file__).resolve().parent / "data"

AFIB_RECORDS = ["201", "202", "210", "219", "221", "222"]
NORMAL_RECORDS = ["100", "101", "103", "106", "111", "119", "200"]

BEAT_SYMBOLS = set("NLRBAaJSVrFejnE/fQ")
RR_HISTORY_LEN = 8
SDNN_THRESHOLD_MS = 150.0


def load_labeled_beats(record_id: str):
    path = str(DATA_DIR / record_id)
    ann = wfdb.rdann(path, "atr")
    rec = wfdb.rdrecord(path)
    fs = rec.fs

    # Rhythm spans: sample -> label, from '+' annotations (aux_note),
    # sorted by sample. A later '+' overrides the previous label from
    # its sample onward.
    rhythm_spans = []
    for s, sym, aux in zip(ann.sample, ann.symbol, ann.aux_note):
        if sym == "+":
            label = aux.strip("\x00").strip()
            rhythm_spans.append((s, label))
    rhythm_spans.sort()

    def label_for_sample(sample):
        label = None
        for s, lab in rhythm_spans:
            if s <= sample:
                label = lab
            else:
                break
        return label

    beats = []  # (time_ms, label, beat_symbol)
    for s, sym in zip(ann.sample, ann.symbol):
        if sym in BEAT_SYMBOLS:
            beats.append((s / fs * 1000.0, label_for_sample(s), sym))
    return beats


def sign_change_rate(diffs):
    if len(diffs) < 2:
        return 0.0
    changes = 0
    for a, b in zip(diffs, diffs[1:]):
        if a == 0 or b == 0:
            continue
        if (a > 0) != (b > 0):
            changes += 1
    return changes / (len(diffs) - 1)


def windows_for_label(beats, wanted_labels, window_len=RR_HISTORY_LEN,
                       require_normal_beats=False):
    """Yield RR-interval windows (length window_len-1) where all
    window_len beats share a label in wanted_labels, with no rhythm
    transition inside the window. If require_normal_beats, every beat's
    own symbol must be 'N' too - excludes windows whose high SDNN is
    actually driven by an isolated ectopic beat (e.g. a PVC) rather than
    smooth sinus-rhythm variability, even though the rhythm span is
    still labeled "(N" overall."""
    times = [t for t, lab, sym in beats]
    labels = [lab for t, lab, sym in beats]
    symbols = [sym for t, lab, sym in beats]
    n = len(beats)
    for i in range(n - window_len + 1):
        window_labels = labels[i:i + window_len]
        if len(set(window_labels)) != 1:
            continue
        lab = window_labels[0]
        if lab not in wanted_labels:
            continue
        if require_normal_beats:
            window_symbols = symbols[i:i + window_len]
            if any(s != "N" for s in window_symbols):
                continue
        window_times = times[i:i + window_len]
        rr = [window_times[k + 1] - window_times[k] for k in range(window_len - 1)]
        # Skip physiologically-impossible RR (annotation artifacts / gaps)
        if any(r < 300 or r > 2500 for r in rr):
            continue
        yield rr


def rr_stats(rr):
    sorted_rr = sorted(rr)
    median_rr = sorted_rr[len(sorted_rr) // 2]
    mean_rr = sum(rr) / len(rr)
    sdnn = statistics.pstdev(rr) if len(rr) > 1 else 0.0
    diffs = [rr[k + 1] - rr[k] for k in range(len(rr) - 1)]
    scr = sign_change_rate(diffs)
    return median_rr, sdnn, scr


def evaluate(threshold_scr, window_len=RR_HISTORY_LEN, require_normal_beats=False):
    afib_windows = []
    for r in AFIB_RECORDS:
        beats = load_labeled_beats(r)
        for rr in windows_for_label(beats, {"(AFIB", "(AFL"}, window_len=window_len):
            afib_windows.append(rr_stats(rr))

    normal_windows = []
    for r in NORMAL_RECORDS + AFIB_RECORDS:
        beats = load_labeled_beats(r)
        for rr in windows_for_label(beats, {"(N"}, window_len=window_len,
                                     require_normal_beats=require_normal_beats):
            normal_windows.append(rr_stats(rr))

    def rates(windows):
        before = sum(1 for _, sdnn, scr in windows if sdnn > SDNN_THRESHOLD_MS)
        after = sum(1 for _, sdnn, scr in windows
                    if sdnn > SDNN_THRESHOLD_MS and scr >= threshold_scr)
        return before, after, len(windows)

    afib_before, afib_after, afib_total = rates(afib_windows)
    normal_before, normal_after, normal_total = rates(normal_windows)

    return {
        "afib_total": afib_total,
        "afib_sens_before": 100.0 * afib_before / afib_total if afib_total else float("nan"),
        "afib_sens_after": 100.0 * afib_after / afib_total if afib_total else float("nan"),
        "normal_total": normal_total,
        "normal_fp_before": 100.0 * normal_before / normal_total if normal_total else float("nan"),
        "normal_fp_after": 100.0 * normal_after / normal_total if normal_total else float("nan"),
        "afib_windows": afib_windows,
        "normal_windows": normal_windows,
    }


if __name__ == "__main__":
    import sys

    threshold = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
    window_len = int(sys.argv[2]) if len(sys.argv) > 2 else RR_HISTORY_LEN
    require_normal_beats = (sys.argv[3] == "1") if len(sys.argv) > 3 else False

    result = evaluate(threshold, window_len=window_len, require_normal_beats=require_normal_beats)

    print(f"AFIB/AFL-labeled windows: {result['afib_total']}")
    print(f"Normal(N)-labeled windows: {result['normal_total']}")
    print()
    print(f"{'':20}{'Sensitivity/FP-rate (SDNN>150 only)':>36}{'with SCR>=%.2f gate' % threshold:>28}")
    print(f"{'AFib sensitivity':20}{result['afib_sens_before']:>35.1f}%{result['afib_sens_after']:>27.1f}%")
    print(f"{'Normal FP rate':20}{result['normal_fp_before']:>35.1f}%{result['normal_fp_after']:>27.1f}%")

    print()
    print("Sign-change-rate distribution (AFIB windows with SDNN>150):")
    scrs = [scr for _, sdnn, scr in result["afib_windows"] if sdnn > SDNN_THRESHOLD_MS]
    if scrs:
        print(f"  n={len(scrs)} mean={statistics.mean(scrs):.2f} "
              f"median={statistics.median(scrs):.2f} "
              f"min={min(scrs):.2f} max={max(scrs):.2f}")

    print("Sign-change-rate distribution (Normal windows with SDNN>150, i.e. current false positives):")
    scrs = [scr for _, sdnn, scr in result["normal_windows"] if sdnn > SDNN_THRESHOLD_MS]
    if scrs:
        print(f"  n={len(scrs)} mean={statistics.mean(scrs):.2f} "
              f"median={statistics.median(scrs):.2f} "
              f"min={min(scrs):.2f} max={max(scrs):.2f}")
