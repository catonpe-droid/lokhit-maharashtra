#!/usr/bin/env python3
"""Sync MLVM public dashboard aggregates from the published CSV.

Never save raw CSV, personal names, registration IDs, contact numbers or email addresses
into this repository. Fail closed if the published file schema is unexpected.
"""
import csv
import io
import json
import re
import sys
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

SOURCE_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vR9Wl653D8WU3JNusIsfDJapFaKuRnBnBDLjDBWBPBAtDlu7jWrzBDDXqvoUjYE5qqSxWchQ-gt-twM"
    "/pub?output=csv"
)
DATA_PATH = Path(__file__).with_name("data.json")
REQUIRED = [
    "MLVM नोंदणी ID", "नोंदणी तारीख व वेळ", "जिल्हा",
    "कार्यक्षेत्रातील गावसंख्या", "दुष्काळ निवारणासाठी योगदान",
    "कार्यकर्त्यांची संख्या", "नोंदणीची स्थिती",
]
TOPICS = {
    "water": r"पाणी|जल|विहीर|विहिर|गाळ|बंधारा|सिंचन|तलाव|वॉटर|water",
    "livestock": r"चारा|पशु|जनावर|गाय|गुरे|बकरी|शेळी|fodder|livestock",
    "survey": r"सर्वे|सर्व्हे|लाभार्थी|माहिती संकलन|डेटा|survey|mapping",
    "scheme": r"शासन|शासकीय|योजना|प्रशासन|ग्रामपंचायत|समन्वय|convergence|पंचायत",
    "awareness": r"जागृती|प्रशिक्षण|शिबिर|प्रबोधन|मार्गदर्शन|बैठक|awareness|training",
    "relief": r"मदत|वितरण|वाटप|किट|धान्य|राशन|relief|distribution",
    "livelihood": r"शेती|कृषी|बियाण|रोजगार|उपजीविका|livelihood|agriculture",
    "community": r"महिला|बाल|समुदाय|सामाजिक|दलित|आदिवासी|गट|समूह|community",
}
TOPICS = {name: re.compile(pattern, re.IGNORECASE) for name, pattern in TOPICS.items()}
VERIFIED = re.compile(r"^(पडताळलेली|पडताळणी पूर्ण|सत्यापित|verified|approved|मान्य)$", re.IGNORECASE)

def safe_number(value):
    s = str(value or "0").strip().replace(",", "")
    try:
        n = int(s)
    except (ValueError, TypeError):
        return 0
    return max(0, n) if n <= 1000000 else 0

def download_rows():
    request = urllib.request.Request(
        SOURCE_URL + "&v=" + datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%Y%m%d%H%M"),
        headers={"User-Agent": "MLVM-dashboard-aggregate-sync/1.0", "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        blob = response.read(6 * 1024 * 1024 + 1)
        if len(blob) > 6 * 1024 * 1024:
            raise ValueError("Published CSV exceeds safe size limit")
    stream = io.StringIO(blob.decode("utf-8-sig"))
    reader = csv.DictReader(stream)
    actual = [str(k or "").strip() for k in (reader.fieldnames or [])]
    missing = [name for name in REQUIRED if name not in actual]
    if missing:
        raise ValueError("Unexpected CSV layout; refused to replace dashboard snapshot")
    return list(reader)

def build(rows, baseline):
    districts = []
    for entry in baseline["districts"]:
        name = entry["name"]
        districts.append({
            "name": name, "count": 0, "workers": 0, "villages": 0,
            "verified": 0, "activities": {key: 0 for key in TOPICS},
        })
    district_index = {d["name"]: d for d in districts}
    dates = Counter()
    topics = Counter()
    organizations = workers = villages = verified = categorized = 0
    for row in rows:
        if not str(row.get("MLVM नोंदणी ID") or "").strip():
            continue
        district = district_index.get(str(row.get("जिल्हा") or "").strip())
        if district is None:
            continue
        organizations += 1
        district["count"] += 1
        w = safe_number(row.get("कार्यकर्त्यांची संख्या"))
        v = safe_number(row.get("कार्यक्षेत्रातील गावसंख्या"))
        workers += w
        villages += v
        district["workers"] += w
        district["villages"] += v
        if VERIFIED.match(str(row.get("नोंदणीची स्थिती") or "").strip()):
            verified += 1
            district["verified"] += 1
        day = str(row.get("नोंदणी तारीख व वेळ") or "")[:10]
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
            dates[day] += 1
        capacity = str(row.get("दुष्काळ निवारणासाठी योगदान") or "")
        matched = False
        for key, regex in TOPICS.items():
            if regex.search(capacity):
                matched = True
                topics[key] += 1
                district["activities"][key] += 1
        if matched:
            categorized += 1
    if len(rows) > 0 and organizations == 0:
        raise ValueError("No valid Maharashtra NGO rows: refusing to overwrite data")
    stamp = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d %H:%M:%S")
    return {
        "schemaVersion": 1,
        "snapshotAt": stamp,
        "generatedOn": stamp[:10],
        "live": False,
        "sourceMode": "published_csv",
        "source": "महाराष्ट्र लोक विकास मंच — प्राप्त संस्था नोंदणी (स्वयंघोषित माहिती)",
        "totals": {
            "organizations": organizations,
            "districtsWithRegistrations": sum(bool(d["count"]) for d in districts),
            "districtsTotal": 36, "workers": workers, "villages": villages, "verified": verified,
        },
        "districts": districts,
        "activities": [
            {"key": a["key"], "label": a["label"], "count": topics[a["key"]]}
            for a in baseline["activities"]
        ],
        "dates": [{"date": day, "count": dates[day]} for day in sorted(dates)[-14:]],
        "quality": {
            "notYetVerified": organizations - verified,
            "noMatchedCapacityCategory": organizations - categorized,
            "taggedCapacity": categorized,
        },
    }

def meaningful_data(value):
    return {key: val for key, val in value.items() if key not in ("snapshotAt", "generatedOn")}

def main():
    baseline = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    fresh = build(download_rows(), baseline)
    if meaningful_data(fresh) == meaningful_data(baseline):
        print("No new NGO registrations / aggregate changes; snapshot unchanged.")
        return 0
    if fresh["totals"]["organizations"] < baseline["totals"]["organizations"] * 0.65:
        raise ValueError("Large sudden decrease in registrations; refusing to publish")
    DATA_PATH.write_text(json.dumps(fresh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Aggregated dashboard update:", fresh["totals"]["organizations"],
          "NGOs across", fresh["totals"]["districtsWithRegistrations"], "districts")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print("Published CSV sync failed safely:", str(error), file=sys.stderr)
        sys.exit(1)
