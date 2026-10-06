#!/usr/bin/env python3
"""Compare A/B test logs for the WiFi-noise investigation. For each log:
  - count / fraction of non-Normal rhythm classifications
  - count of beat-to-beat HR swings >20bpm
  - SDNN trend (first/last/mean/max)
  - total dropped samples (summed DroppedSamples: N lines)
"""

import csv
import re
import sys
from pathlib import Path

RPEAK_RE = re.compile(r"R-peak detected \| RR: (\d+) ms \| HR: ([\d.]+) bpm")
STATUS_RE = re.compile(r"\s*-> Median HR: ([\d.]+) bpm \| SDNN: ([\d.]+) ms \| Status: (.+)")
DROPPED_RE = re.compile(r"DroppedSamples: (\d+)")


def analyze(path: Path):
    hrs = []       # instantaneous per-beat HR, in order
    statuses = []  # (elapsed_ms, medianHR, sdnn, status)
    dropped_total = 0

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if len(row) < 2:
                continue
            elapsed_ms, line = row[0], row[1]
            m = RPEAK_RE.match(line)
            if m:
                hrs.append(float(m.group(2)))
                continue
            m = STATUS_RE.match(line)
            if m:
                statuses.append((int(elapsed_ms), float(m.group(1)), float(m.group(2)), m.group(3)))
                continue
            m = DROPPED_RE.match(line)
            if m:
                dropped_total += int(m.group(1))

    non_normal = [s for s in statuses if s[3] != "Normal"]
    swings = sum(1 for i in range(1, len(hrs)) if abs(hrs[i] - hrs[i - 1]) > 20)
    sdnns = [s[2] for s in statuses]

    print(f"=== {path.name} ===")
    print(f"  R-peaks detected: {len(hrs)}")
    print(f"  Classifications: {len(statuses)} total, {len(non_normal)} non-Normal "
          f"({100 * len(non_normal) / len(statuses):.1f}%)" if statuses else "  Classifications: 0")
    for elapsed, medhr, sdnn, status in non_normal:
        print(f"    t={elapsed}ms  medianHR={medhr:.1f}  SDNN={sdnn:.1f}  {status}")
    print(f"  Beat-to-beat HR swings >20bpm: {swings} / {max(len(hrs)-1,0)} intervals")
    if sdnns:
        print(f"  SDNN: first={sdnns[0]:.1f}  last={sdnns[-1]:.1f}  "
              f"mean={sum(sdnns)/len(sdnns):.1f}  max={max(sdnns):.1f}")
    print(f"  Total dropped samples: {dropped_total}")
    print()

    return {
        "file": path.name,
        "rpeaks": len(hrs),
        "classifications": len(statuses),
        "non_normal": len(non_normal),
        "swings_gt20": swings,
        "dropped_total": dropped_total,
    }


if __name__ == "__main__":
    paths = [Path(p) for p in sys.argv[1:]]
    if not paths:
        sys.exit("Usage: python analyze_ab_logs.py <log1.csv> <log2.csv> <log3.csv> ...")
    results = [analyze(p) for p in paths]

    print("=== Summary ===")
    print(f"{'File':<45}{'RPeaks':>8}{'NonNormal':>11}{'Swings>20':>11}{'Dropped':>10}")
    for r in results:
        print(f"{r['file']:<45}{r['rpeaks']:>8}{r['non_normal']:>11}{r['swings_gt20']:>11}{r['dropped_total']:>10}")
