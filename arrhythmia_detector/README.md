# ESP32 + AD8232 Arrhythmia Detector

## Run it

```
python flash_and_log.py
```

That compiles the sketch, uploads it to the ESP32 on `COM11`, then opens the
serial port at 115200 baud and logs every line to a timestamped CSV file in
`logs/` (columns: `elapsed_ms`, `raw_line`). Press `Ctrl+C` to stop; the
serial port and log file are closed cleanly.

## Ground-truth beat marking

While it's logging, keep the terminal window running the script focused and
press **spacebar** each time you feel or count a heartbeat (e.g. tapping
along with a phone pulse app, or your own pulse). Each press is logged as a
`GROUND_TRUTH_BEAT` row, interleaved by timestamp with the ESP32's serial
lines, so you can later see exactly how your marks line up with the
detector's output.

When you press `Ctrl+C` to end the session, a summary is printed comparing
ESP32-detected R-peaks against your ground-truth marks:

- **Matched**: an ESP32 peak within ±150ms of a ground-truth mark counts as
  a correct detection
- **False positives**: ESP32 peaks with no nearby ground-truth mark
- **Missed beats**: ground-truth marks with no nearby ESP32 peak
- **Sensitivity**: matched / total ground-truth marks, as a percentage

Note: spacebar detection uses Windows console input (`msvcrt`), so it only
works if the terminal window is the active/focused window when you press
the key.

Options (only needed if your setup changes):

```
python flash_and_log.py --port COM7             # different COM port
python flash_and_log.py --fqbn esp32:esp32:esp32 # different board
python flash_and_log.py --skip-upload            # just log, don't reflash
```

## Requirements

- `arduino-cli` on PATH with the `esp32:esp32` core installed
- `pip install pyserial`
