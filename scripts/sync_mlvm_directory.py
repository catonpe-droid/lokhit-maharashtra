#!/usr/bin/env python3
"""Refresh the public MLVM directory from the published CSV (no personal contacts)."""
import csv
import io
import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vR9Wl653D8WU3JNusIsfDJapFaKuRnBnBDLjDBWBPBAtDlu7jWrzBDDXqvoUjYE5qqSxWchQ-gt-twM"
    "/pub?output=csv"
)
TARGET = Path("MLVMData/dashboard/organizations.json")
ID_RE = re.compile(r"^MLVM-\d{2}-\d{5,}$")
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{10,}$")

def field(row, index):
    return (row[index] if index < len(row) else "").strip()[:250]

def load_published():
    req = Request(CSV_URL, headers={"User-Agent": "MLVM-Public-Directory-Sync/1.0", "Accept": "text/csv,*/*"})
    with urlopen(req, timeout=35) as response:
        raw = response.read().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(raw)))
    if not rows or "MLVM" not in field(rows[0],0).upper():
        raise RuntimeError("Published CSV columns do not match the MLVM sheet")
    seen = set()
    records = []
    for row in rows[1:]:
        record = {
            "id": field(row,0),
            "date": field(row,1),
            "district": field(row,2),
            "name": field(row,3),
            "taluka": field(row,6),
            "registration": field(row,10),
            "status": field(row,12) or "प्राप्त",
        }
        if not ID_RE.fullmatch(record["id"]) or not record["district"] or not record["name"]:
            continue
        if record["id"] in seen:
            continue
        seen.add(record["id"])
        if PHONE_RE.fullmatch(record["taluka"]):
            record["taluka"] = ""
        records.append(record)
    if len(records) < 20:
        raise RuntimeError("Too few records: refusing to overwrite the public list")
    return records

def main():
    records = load_published()
    if TARGET.exists():
        try:
            old = json.loads(TARGET.read_text(encoding="utf-8"))
            old_count = len(old.get("organizations", []))
            if len(records) < old_count:
                print(f"Published CSV has only {len(records)} records; keeping newer snapshot of {old_count}")
                return
        except (ValueError, OSError):
            pass
    payload = {
        "schemaVersion": 1,
        "snapshotAt": max((x["date"] for x in records), default=""),
        "count": len(records),
        "organizations": records,
    }
    updated = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(updated, encoding="utf-8")
    print(f"MLVM directory: {len(records)} records (individual contact fields excluded)")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"MLVM directory sync failed safely: {exc}", file=sys.stderr)
        sys.exit(1)
