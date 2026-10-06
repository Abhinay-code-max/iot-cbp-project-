#!/usr/bin/env python3
"""Compile, upload, and log serial output from the ESP32 arrhythmia detector.

While logging, press SPACEBAR (with this terminal window focused) each time
you feel/count a heartbeat. Each press is logged as a GROUND_TRUTH_BEAT event,
interleaved by timestamp with the ESP32's serial lines. On Ctrl+C, a summary
compares ESP32-detected R-peaks against your ground-truth marks.

Usage:
    python flash_and_log.py
    python flash_and_log.py --port COM11 --fqbn esp32:esp32:esp32
    python flash_and_log.py --skip-upload   # just log, don't reflash

Requires arduino-cli on PATH, pyserial installed (pip install pyserial), and
Windows (uses msvcrt for non-blocking keyboard polling).
"""

import argparse
import csv
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

try:
    import serial
except ImportError:
    sys.exit("pyserial is required. Install it with: pip install pyserial")

try:
    import msvcrt
except ImportError:
    sys.exit("This script's spacebar marking relies on msvcrt, which is Windows-only.")

SKETCH_DIR = Path(__file__).resolve().parent
LOG_DIR = SKETCH_DIR / "logs"

DEFAULT_PORT = "COM11"
DEFAULT_FQBN = "esp32:esp32:esp32"
BAUD_RATE = 115200
MATCH_TOLERANCE_MS = 150


def compile_and_upload(port: str, fqbn: str) -> None:
    cmd = [
        "arduino-cli", "compile",
        "--fqbn", fqbn,
        "--upload",
        "-p", port,
        str(SKETCH_DIR),
    ]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        sys.exit(f"arduino-cli compile/upload failed (exit code {result.returncode})")


def match_beats(detected, truth, tolerance_ms=MATCH_TOLERANCE_MS):
    """Two-pointer chronological matching within +/-tolerance_ms. Returns
    (matched_count, false_positive_count, missed_count)."""
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
            i += 1  # unmatched detected peak (false positive)
        else:
            j += 1  # unmatched ground-truth mark (missed beat)
    false_positives = len(detected) - matched
    missed = len(truth) - matched
    return matched, false_positives, missed


def print_summary(r_peak_times, ground_truth_times):
    matched, false_positives, missed = match_beats(r_peak_times, ground_truth_times)
    print("\n=== Session Summary ===")
    print(f"ESP32-detected R-peaks: {len(r_peak_times)}")
    print(f"Ground-truth marks:     {len(ground_truth_times)}")
    print(f"Matched (within +/-{MATCH_TOLERANCE_MS}ms): {matched}")
    print(f"False positives (ESP32 peaks with no nearby mark): {false_positives}")
    print(f"Missed beats (marks with no nearby ESP32 peak): {missed}")
    if ground_truth_times:
        sensitivity = 100.0 * matched / len(ground_truth_times)
        print(f"Sensitivity: {sensitivity:.1f}%")
    else:
        print("Sensitivity: N/A (no ground-truth marks recorded)")


def log_serial(port: str) -> None:
    LOG_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = LOG_DIR / f"ecg_log_{timestamp}.csv"

    print(f"Opening {port} at {BAUD_RATE} baud...")
    time.sleep(2)  # let the ESP32 finish rebooting after the upload reset

    ser = serial.Serial(port, BAUD_RATE, timeout=1)
    csv_file = open(log_path, "w", newline="", encoding="utf-8")
    writer = csv.writer(csv_file)
    writer.writerow(["elapsed_ms", "raw_line"])
    csv_file.flush()

    start = time.monotonic()
    write_lock = threading.Lock()
    stop_event = threading.Event()
    r_peak_times = []
    ground_truth_times = []

    def write_row(text):
        with write_lock:
            elapsed_ms = (time.monotonic() - start) * 1000.0
            writer.writerow([int(elapsed_ms), text])
            csv_file.flush()
        return elapsed_ms

    def serial_worker():
        while not stop_event.is_set():
            try:
                line = ser.readline()
            except serial.SerialException:
                break
            if not line:
                continue
            text = line.decode("utf-8", errors="replace").rstrip("\r\n")
            elapsed_ms = write_row(text)
            print(text)
            if text.startswith("R-peak detected"):
                r_peak_times.append(elapsed_ms)

    def keyboard_worker():
        while not stop_event.is_set():
            if msvcrt.kbhit():
                key = msvcrt.getch()
                if key == b" ":
                    elapsed_ms = write_row("GROUND_TRUTH_BEAT")
                    ground_truth_times.append(elapsed_ms)
                    print(f"[GROUND_TRUTH_BEAT marked at {elapsed_ms:.0f}ms]")
            else:
                time.sleep(0.015)

    print(f"Logging to {log_path}")
    print("Press SPACEBAR (this window focused) to mark a felt heartbeat.")
    print("Press Ctrl+C to stop.")

    t_serial = threading.Thread(target=serial_worker, daemon=True)
    t_keyboard = threading.Thread(target=keyboard_worker, daemon=True)
    t_serial.start()
    t_keyboard.start()

    try:
        while True:
            time.sleep(0.2)
    except KeyboardInterrupt:
        print("\nStopping (Ctrl+C received). Closing serial port and log file.")
        stop_event.set()
        t_serial.join(timeout=2)
        t_keyboard.join(timeout=2)
        ser.close()
        csv_file.close()
        print_summary(r_peak_times, ground_truth_times)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default=DEFAULT_PORT, help=f"Serial port (default: {DEFAULT_PORT})")
    parser.add_argument("--fqbn", default=DEFAULT_FQBN, help=f"Board FQBN (default: {DEFAULT_FQBN})")
    parser.add_argument("--skip-upload", action="store_true", help="Skip compile/upload, just log serial output")
    args = parser.parse_args()

    if not args.skip_upload:
        compile_and_upload(args.port, args.fqbn)

    log_serial(args.port)


if __name__ == "__main__":
    main()
