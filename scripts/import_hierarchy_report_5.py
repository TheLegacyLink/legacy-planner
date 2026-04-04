#!/usr/bin/env python3
import csv
import json
from pathlib import Path

workspace = Path('/Users/emaniai/.openclaw/workspace')
csv_path = workspace / 'Hierarchy Reports (5).csv'
json_path = workspace / 'legacy-planner/data/licensedAgents.json'

text = csv_path.read_text(encoding='utf-8', errors='ignore').splitlines()
header_idx = None
for i, line in enumerate(text):
    if line.startswith('Agent #,Broker Id,Agent Hierarchy Level,Contract Level,Status Code,Agent Name,Agent Email,Phone Number,Address,City,State,Zip Code,Status,Last Produced,NPN,Hierarchy Level,Hierarchy Name,Hierarchy AgentID,Annualized,Effective Date,EFT,AML,AML Base Course Date,AML Recertification Date,AML Renewal Date'):
        header_idx = i
        break
if header_idx is None:
    raise SystemExit('Could not find CSV header row in hierarchy report')

rows = list(csv.DictReader(text[header_idx:]))
existing = json.loads(json_path.read_text())

by_key = {}
for r in existing:
    key = ((r.get('agent_id') or '').strip(), (r.get('state_code') or '').strip())
    by_key[key] = r

new_count = 0
updated_count = 0

for row in rows:
    agent_id = (row.get('Agent #') or '').strip()
    if not agent_id:
        continue

    status = (row.get('Status') or '').strip() or 'Active'
    if status.lower() not in {'active', 'licensed', 'inforce', 'in force'}:
        continue

    full_name = (row.get('Agent Name') or '').strip().strip('"')
    email = (row.get('Agent Email') or '').strip()
    phone = (row.get('Phone Number') or '').strip()
    city = (row.get('City') or '').strip()
    home_state = (row.get('State') or '').strip()
    state_code = home_state
    effective_date = (row.get('Effective Date') or '').strip()

    key = (agent_id, state_code)
    if key in by_key:
        rec = by_key[key]
        rec['full_name'] = full_name or rec.get('full_name', '')
        rec['email'] = email or rec.get('email', '')
        rec['phone'] = phone or rec.get('phone', '')
        rec['city'] = city or rec.get('city', '')
        rec['home_state'] = home_state or rec.get('home_state', '')
        rec['state_code'] = state_code or rec.get('state_code', '')
        rec['license_status'] = status or rec.get('license_status', 'Active')
        if effective_date:
            rec['effective_date'] = effective_date
        rec.setdefault('carriers_active', [])
        rec.setdefault('carriers_all', [])
        rec.setdefault('carrier_details', [])
        updated_count += 1
    else:
        by_key[key] = {
            'agent_id': agent_id,
            'full_name': full_name,
            'email': email,
            'phone': phone,
            'city': city,
            'home_state': home_state,
            'state_code': state_code,
            'license_status': status,
            'carriers_active': [],
            'carriers_all': [],
            'carrier_details': [],
            **({'effective_date': effective_date} if effective_date else {}),
        }
        rec = by_key[key]
        new_count += 1

    # Ensure F&G carrier mapping exists and uses Agent # as carrier agent id.
    details = rec.setdefault('carrier_details', [])
    fg_detail = None
    for d in details:
        if (d.get('carrier') or '').strip().lower() in {'f&g', 'fg'}:
            fg_detail = d
            break

    if fg_detail is None:
        details.append(
            {
                'carrier': 'F&G',
                'contract_status': 'Active',
                'carrier_agent_id': agent_id,
            }
        )
    else:
        fg_detail['carrier'] = 'F&G'
        fg_detail['contract_status'] = fg_detail.get('contract_status') or 'Active'
        fg_detail['carrier_agent_id'] = agent_id

    carriers_active = set(rec.get('carriers_active') or [])
    carriers_all = set(rec.get('carriers_all') or [])
    carriers_active.add('F&G')
    carriers_all.add('F&G')
    rec['carriers_active'] = sorted(carriers_active)
    rec['carriers_all'] = sorted(carriers_all)

merged = list(by_key.values())
merged.sort(key=lambda r: ((r.get('full_name') or '').upper(), (r.get('state_code') or '')))
json_path.write_text(json.dumps(merged, indent=2))

print(f'Parsed rows: {len(rows)}')
print(f'Updated existing rows: {updated_count}')
print(f'Added new rows: {new_count}')
print(f'Total rows now: {len(merged)}')
print(f'Wrote: {json_path}')
