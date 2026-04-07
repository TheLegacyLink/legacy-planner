import json
import re
import urllib.parse
import urllib.request
from pathlib import Path


def get(url):
    return json.load(urllib.request.urlopen(url))


def norm(s):
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


claims = get("https://innercirclelink.com/api/lead-claims?viewer=" + urllib.parse.quote("Andrea Cannon")).get("rows", [])
apps = get("https://innercirclelink.com/api/sponsorship-applications").get("rows", [])
app_by_id = {str(r.get("id", "")).strip(): r for r in apps if str(r.get("id", "")).strip()}

exclude_keywords = ["booked", "approved", "declin", "completed", "contract signed", "payment received", "onboarding pending", "onboarding_complete"]

filtered, excluded = [], []
for r in claims:
    sid = str(r.get("source_application_id", "")).strip()
    app = app_by_id.get(sid)
    status = norm((app or {}).get("status", ""))
    if any(k in status for k in exclude_keywords):
        excluded.append((r, status or "(none)"))
        continue
    cstatus = norm(r.get("claim_status", ""))
    if cstatus.startswith("claimed") or cstatus.startswith("invalid"):
        excluded.append((r, "claim:" + cstatus))
        continue
    filtered.append(r)

filtered = sorted(filtered, key=lambda x: (str(x.get("requested_at_est", "")), str(x.get("applicant_name", ""))))
andrea, leticia = [], []
for i, r in enumerate(filtered):
    (andrea if i % 2 == 0 else leticia).append(r)

def format_lines(rows):
    out=[]
    for i, r in enumerate(rows, 1):
        out.append(f"{i}. {r.get('applicant_name','')} | {r.get('applicant_state','')} | {r.get('requested_at_est','')} | {r.get('source_application_id','')}")
    return out

base = Path('/Users/emaniai/.openclaw/workspace/legacy-planner/tmp')
base.mkdir(parents=True, exist_ok=True)

summary = [
    f"TOTAL_VISIBLE {len(claims)}",
    f"EXCLUDED {len(excluded)}",
    f"ELIGIBLE {len(filtered)}",
    f"ANDREA {len(andrea)}",
    f"LETICIA {len(leticia)}",
]
(base / 'lead_split_summary.txt').write_text('\n'.join(summary) + '\n', encoding='utf-8')
(base / 'lead_split_andrea.txt').write_text('\n'.join(format_lines(andrea)) + '\n', encoding='utf-8')
(base / 'lead_split_leticia.txt').write_text('\n'.join(format_lines(leticia)) + '\n', encoding='utf-8')

print('WROTE', str(base / 'lead_split_summary.txt'))
print('WROTE', str(base / 'lead_split_andrea.txt'))
print('WROTE', str(base / 'lead_split_leticia.txt'))
