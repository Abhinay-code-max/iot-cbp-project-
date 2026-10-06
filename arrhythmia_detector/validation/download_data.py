#!/usr/bin/env python3
"""Download a handful of MIT-BIH Arrhythmia Database records from PhysioNet."""

from pathlib import Path
import wfdb

DATA_DIR = Path(__file__).resolve().parent / "data"
RECORDS = ["100", "101", "103", "106", "111", "119", "200"]

if __name__ == "__main__":
    DATA_DIR.mkdir(exist_ok=True)
    print(f"Downloading records {RECORDS} from mitdb into {DATA_DIR} ...")
    wfdb.dl_database("mitdb", str(DATA_DIR), records=RECORDS)
    print("Done. Files:")
    for f in sorted(DATA_DIR.glob("*")):
        print(" ", f.name)
