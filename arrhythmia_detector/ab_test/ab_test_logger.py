#!/usr/bin/env python3
"""Timed, unattended serial logger for the WiFi-noise A/B test. Unlike
flash_and_log.py, this doesn't compile/upload (the right sketch variant
must already be flashed) and doesn't need Ctrl+C - it logs for a fixed
duration and exits automatically.

Usage:
    python ab_test_logger.py --label no_wifi_baseline --duration 60
    python ab_test_logger.py --label wifi_idle --duration 60
    python ab_test_logger.py --label wifi_client_polling --duration 60
"""

import argparse
import csv
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import serial
except ImportError:
    sys.exit("pyserial is required. Install it with: pip install pyserial")

LOG_DIR = Path(__file__).resolve().parent / "logs"
DEFAULT_PORT = "COM11"
BAUD_RATE = 115200


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", required=True, help="Test condition label, e.g. no_wifi_baseline")
    parser.add_argument("--duration", type=float, default=60.0, help="Seconds to log (default: 60)")
    parser.add_argument("--port", default=DEFAULT_PORT, help=f"Serial port (default: {DEFAULT_PORT})")
    args = parser.parse_args()

    LOG_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = LOG_DIR / f"ab_{args.label}_{timestamp}.csv"

    print(f"Opening {args.port} at {BAUD_RATE} baud...")
    ser = serial.Serial(args.port, BAUD_RATE, timeout=1)

    with open(log_path, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(["elapsed_ms", "raw_line"])
        csv_file.flush()

        start = time.monotonic()
        print(f"Logging to {log_path} for {args.duration:.0f}s. Sit still now.")

        while time.monotonic() - start < args.duration:
            line = ser.readline()
            if not line:
                continue
            elapsed_ms = int((time.monotonic() - start) * 1000)
            text = line.decode("utf-8", errors="replace").rstrip("\r\n")
            writer.writerow([elapsed_ms, text])
            csv_file.flush()
            print(text)

    ser.close()
    print(f"Done. Saved to {log_path}")


if __name__ == "__main__":
    main()
