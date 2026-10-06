#!/usr/bin/env python3
"""Validate the arrhythmia_detector.ino algorithm (reimplemented in
algorithm.py) against real labeled ECG data from the MIT-BIH Arrhythmia
Database.

For each record:
  - load the MLII channel + beat annotations
  - resample 360Hz -> 250Hz (the .ino's tuned sample rate) via polyphase
    resampling
  - run the reimplemented detector over the resampled signal
  - match detected R-peaks to annotated beats within +/-150ms
  - report sensitivity, false positive rate, false negative rate

Non-beat annotation symbols (rhythm markers, signal-quality markers, etc.)
are excluded from the reference beat set per standard MIT-BIH usage.
"""

import math
from pathlib import Path

import numpy as np
import wfdb
from scipy.signal import resample_poly

from algorithm import run_detector

DATA_DIR = Path(__file__).resolve().parent / "data"
RECORDS = ["100", "101", "103", "106", "111", "119", "200"]

TARGET_FS = 250
MATCH_TOLERANCE_MS = 150

# Standard MIT-BIH / AAMI beat annotation symbols. Excludes non-beat
# markers such as '+' (rhythm change), '~' (signal quality), '|' etc.
BEAT_SYMBOLS = set("NLRBAaJSVrFejnE/fQ")


def match_beats(detected, truth, tolerance_ms=MATCH_TOLERANCE_MS):
    """Two-pointer chronological matching within +/-tolerance_ms.
    Same algorithm used in flash_and_log.py's ground-truth scoring."""
    detected = sorted(detected)
    truth = sorted(truth)
    i = j = 0
    matched = 0
    while i < len(detected) and j < len(truth):
        diff = detected[i] - truth[j]
        if abs(diff) <= tolerance_ms:
            matched += 1
            i += 1
            j += 1
        elif diff < -tolerance_ms:
            i += 1
        else:
            j += 1
    false_positives = len(detected) - matched
    missed = len(truth) - matched
    return matched, false_positives, missed


def load_record(record_id: str):
    path = str(DATA_DIR / record_id)
    rec = wfdb.rdrecord(path)
    ann = wfdb.rdann(path, "atr")

    channel_idx = rec.sig_name.index("MLII")
    signal = rec.p_signal[:, channel_idx]
    fs = rec.fs

    beat_samples = [s for s, sym in zip(ann.sample, ann.symbol) if sym in BEAT_SYMBOLS]
    beat_times_ms = [s / fs * 1000.0 for s in beat_samples]

    return signal, fs, beat_times_ms


def resample_signal(signal, orig_fs, target_fs):
    g = math.gcd(orig_fs, target_fs)
    up, down = target_fs // g, orig_fs // g
    return resample_poly(signal, up, down)


def evaluate_record(record_id: str, **detector_kwargs):
    signal, orig_fs, ref_beat_times_ms = load_record(record_id)
    resampled = resample_signal(signal, orig_fs, TARGET_FS)

    detected_times_ms = run_detector(resampled, **detector_kwargs)

    matched, fp, fn = match_beats(detected_times_ms, ref_beat_times_ms)
    total_ref = len(ref_beat_times_ms)
    total_detected = len(detected_times_ms)

    sensitivity = 100.0 * matched / total_ref if total_ref else float("nan")
    fp_rate = 100.0 * fp / total_detected if total_detected else float("nan")
    fn_rate = 100.0 * fn / total_ref if total_ref else float("nan")

    return {
        "record": record_id,
        "ref_beats": total_ref,
        "detected": total_detected,
        "matched": matched,
        "false_positives": fp,
        "false_negatives": fn,
        "sensitivity_pct": sensitivity,
        "fp_rate_pct": fp_rate,
        "fn_rate_pct": fn_rate,
    }


def print_report(results):
    print(f"{'Record':<8}{'Ref':>6}{'Det':>6}{'Match':>7}{'FP':>6}{'FN':>6}"
          f"{'Sens%':>8}{'FPrate%':>9}{'FNrate%':>9}")
    for r in results:
        print(f"{r['record']:<8}{r['ref_beats']:>6}{r['detected']:>6}{r['matched']:>7}"
              f"{r['false_positives']:>6}{r['false_negatives']:>6}"
              f"{r['sensitivity_pct']:>8.1f}{r['fp_rate_pct']:>9.1f}{r['fn_rate_pct']:>9.1f}")

    total_ref = sum(r["ref_beats"] for r in results)
    total_det = sum(r["detected"] for r in results)
    total_matched = sum(r["matched"] for r in results)
    total_fp = sum(r["false_positives"] for r in results)
    total_fn = sum(r["false_negatives"] for r in results)
    overall_sens = 100.0 * total_matched / total_ref if total_ref else float("nan")
    overall_fp_rate = 100.0 * total_fp / total_det if total_det else float("nan")
    overall_fn_rate = 100.0 * total_fn / total_ref if total_ref else float("nan")
    print("-" * 63)
    print(f"{'OVERALL':<8}{total_ref:>6}{total_det:>6}{total_matched:>7}"
          f"{total_fp:>6}{total_fn:>6}{overall_sens:>8.1f}{overall_fp_rate:>9.1f}{overall_fn_rate:>9.1f}")


if __name__ == "__main__":
    results = [evaluate_record(r) for r in RECORDS]
    print_report(results)
