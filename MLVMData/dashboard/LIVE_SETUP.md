# MLVM dashboard — automatic published CSV sync

## Active design (no Apps Script deployment required)

- Published CSV source: `https://docs.google.com/spreadsheets/d/e/2PACX-1vR9Wl653D8WU3JNusIsfDJapFaKuRnBnBDLjDBWBPBAtDlu7jWrzBDDXqvoUjYE5qqSxWchQ-gt-twM/pub?output=csv`
- GitHub Actions workflow: [mlvm-csv-sync.yml](../../.github/workflows/mlvm-csv-sync.yml)
- Aggregator: [sync_live_csv.py](./sync_live_csv.py)
- Public, **anonymous** dataset: [data.json](./data.json)
- Dashboard page: [live dashboard](https://lokhitmaharashtra.com/MLVMData/dashboard/)

Every five minutes GitHub Actions attempts to download the CSV, validates the registration column names, computes the counts for all 36 districts, topic summaries, verification statuses and date trend, then commits **only changed aggregates** to `data.json`. No names, phone numbers, registration IDs or email addresses are copied to GitHub. The browser reads the latest available aggregate snapshot on page load and when the visitor clicks **⟳ अपडेट करा**. No automatic refresh runs while the page stays open. GitHub schedule and GitHub Pages propagation may be delayed; this is a **near-live** sync rather than a sub-minute realtime connection.

## First test / troubleshooting

1. Visit https://github.com/catonpe-droid/lokhit-maharashtra/actions/workflows/mlvm-csv-sync.yml and inspect the latest workflow status. If necessary, use the **Run workflow** action to trigger the first sync. GitHub Actions must be enabled with contents write permission.
2. The script must see these first-sheet CSV headers: `MLVM नोंदणी ID`, `नोंदणी तारीख व वेळ`, `जिल्हा`, `कार्यक्षेत्रातील गावसंख्या`, `दुष्काळ निवारणासाठी योगदान`, `कार्यकर्त्यांची संख्या`, `नोंदणीची स्थिती`.
3. After a successful run, the JSON has `sourceMode: published_csv`. The browser will display **Published CSV • साधारण ५ मिनिटांनी अपडेट**. After a failure the script preserves the previous public snapshot rather than fabricating new data.
4. If no new registrations or aggregate changes occurred, the script makes no GitHub commit and leaves the snapshot's last-change time unchanged.

## Privacy warning

**Published CSV is publicly downloadable.** If it exposes personal contact numbers, names or email addresses, this is a separate privacy risk even though the dashboard shows only aggregates. For best practice, publish a **separate summary-only worksheet** as CSV and adjust the aggregator to read that schema, or switch to a private-sheet aggregate API.

The older optional `live-aggregates-api.gs` and `live-config.js` are not used when `live-config.js` stays blank; the CSV GitHub Actions flow does not need them.
