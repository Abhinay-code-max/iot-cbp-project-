#!/usr/bin/env python3
"""Compare two outlier-robust alternatives to population SDNN in
classifyRhythm()'s "Irregular rhythm (possible AFib)" rule, motivated by
rsa_discriminator.py's finding that isolated ectopic beats - not smooth
periodicity - drive most false positives on real normal-sinus data.

Both candidates are computed on the same 8-beat RR window the firmware
already keeps (RR_HISTORY_LEN), so neither needs new state:

  - MAD: median(|rr_i - median(rr)|) over all 8 intervals. Robust because
    the median itself barely moves for one outlier among 8, so a single
    long/short RR pair (e.g. from a PVC's compensatory pause) contributes
    to the deviation sum but doesn't drag the reference point toward it
    the way a mean-based measure would.
  - Trimmed SDNN: drop the single highest and lowest RR value from the
    8, then take ordinary population SDNN of the remaining 6. Directly
    removes one outlier pair before measuring spread at all.

Reuses rsa_discriminator's ground-truth extraction (real MIT-BIH rhythm
annotations, not our own detector's output) and its exact window
definition, so results are comparable to the SDNN and sign-change-rate
numbers already reported for the 8-beat window.
"""

import statistics

from rsa_discriminator import (
    AFIB_RECORDS,
    NORMAL_RECORDS,
    RR_HISTORY_LEN,
    load_labeled_beats,
    windows_for_label,
)

BASELINE_SENS_PCT = 30.9  # population SDNN > 150ms, 8-beat window (already reported)
BASELINE_FP_PCT = 16.3


def population_sdnn(rr):
    return statistics.pstdev(rr)


def mad(rr):
    med = statistics.median(rr)
    deviations = [abs(r - med) for r in rr]
    return statistics.median(deviations)


def trimmed_sdnn(rr):
    trimmed = sorted(rr)[1:-1]  # drop one min, one max -> 6 of 8 remain
    return statistics.pstdev(trimmed)


def collect_windows(window_len=RR_HISTORY_LEN):
    afib_rr = []
    for r in AFIB_RECORDS:
        beats = load_labeled_beats(r)
        afib_rr.extend(windows_for_label(beats, {"(AFIB", "(AFL"}, window_len=window_len))

    normal_rr = []
    for r in NORMAL_RECORDS + AFIB_RECORDS:
        beats = load_labeled_beats(r)
        normal_rr.extend(windows_for_label(beats, {"(N"}, window_len=window_len))

    return afib_rr, normal_rr


def sweep(metric_fn, afib_rr, normal_rr, thresholds):
    afib_vals = [metric_fn(rr) for rr in afib_rr]
    normal_vals = [metric_fn(rr) for rr in normal_rr]
    rows = []
    for t in thresholds:
        sens = 100.0 * sum(1 for v in afib_vals if v > t) / len(afib_vals)
        fp = 100.0 * sum(1 for v in normal_vals if v > t) / len(normal_vals)
        rows.append((t, sens, fp))
    return rows, afib_vals, normal_vals


def find_matched_fp_threshold(rows, target_fp):
    """Pick the threshold whose FP rate is closest to (and at or below,
    if possible) target_fp, to compare sensitivity at matched FP rate."""
    at_or_below = [r for r in rows if r[2] <= target_fp]
    if at_or_below:
        return max(at_or_below, key=lambda r: r[2])  # highest FP still <= target
    return min(rows, key=lambda r: abs(r[2] - target_fp))


def sensitivity_at_fp(rows, target_fp):
    """Interpolate sensitivity at a given FP rate along the (threshold,
    sens, fp) curve, for a fair area-under-curve-style comparison between
    two metrics with different raw scales."""
    # rows are ordered by increasing threshold -> decreasing FP (monotonic
    # for these unimodal metrics). Find the bracketing pair.
    pts = sorted(((fp, sens) for _, sens, fp in rows))  # ascending FP
    if target_fp <= pts[0][0]:
        return pts[0][1]
    if target_fp >= pts[-1][0]:
        return pts[-1][1]
    for (fp0, s0), (fp1, s1) in zip(pts, pts[1:]):
        if fp0 <= target_fp <= fp1:
            if fp1 == fp0:
                return s0
            frac = (target_fp - fp0) / (fp1 - fp0)
            return s0 + frac * (s1 - s0)
    return pts[-1][1]


if __name__ == "__main__":
    afib_rr, normal_rr = collect_windows()
    print(f"AFIB/AFL windows: {len(afib_rr)}   Normal(N) windows: {len(normal_rr)}")
    print(f"Baseline (population SDNN > 150ms): sensitivity={BASELINE_SENS_PCT}% FP={BASELINE_FP_PCT}%")
    print()

    fine_thresholds = [t * 0.5 for t in range(2, 400)]  # 1ms to 199.5ms, 0.5ms steps
    curves = {}

    for name, fn in [("MAD", mad), ("Trimmed SDNN (6 of 8)", trimmed_sdnn)]:
        rows, afib_vals, normal_vals = sweep(fn, afib_rr, normal_rr, fine_thresholds)
        curves[name] = rows
        print(f"=== {name} ===")
        print(f"  AFib windows:   mean={statistics.mean(afib_vals):.1f} median={statistics.median(afib_vals):.1f}")
        print(f"  Normal windows: mean={statistics.mean(normal_vals):.1f} median={statistics.median(normal_vals):.1f}")

        matched = find_matched_fp_threshold(rows, BASELINE_FP_PCT)
        print(f"  --> At FP rate matched to baseline ({matched[2]:.1f}% <= {BASELINE_FP_PCT}%): "
              f"threshold={matched[0]:.1f}, sensitivity={matched[1]:.1f}% (baseline {BASELINE_SENS_PCT}%)")

        sens_matched = min(rows, key=lambda r: abs(r[1] - BASELINE_SENS_PCT))
        print(f"  --> At sensitivity matched to baseline ({sens_matched[1]:.1f}% ~= {BASELINE_SENS_PCT}%): "
              f"threshold={sens_matched[0]:.1f}, FP rate={sens_matched[2]:.1f}% (baseline {BASELINE_FP_PCT}%)")
        print()

    print("=== Head-to-head: sensitivity at matched FP rate, across the realistic operating range ===")
    print(f"  {'FP rate target':>16}{'MAD sens%':>14}{'Trimmed sens%':>16}{'winner':>10}")
    for target_fp in [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30]:
        s_mad = sensitivity_at_fp(curves["MAD"], target_fp)
        s_trim = sensitivity_at_fp(curves["Trimmed SDNN (6 of 8)"], target_fp)
        winner = "MAD" if s_mad > s_trim + 0.5 else ("Trimmed" if s_trim > s_mad + 0.5 else "tie")
        print(f"  {target_fp:>15}%{s_mad:>13.1f}%{s_trim:>15.1f}%{winner:>10}")
