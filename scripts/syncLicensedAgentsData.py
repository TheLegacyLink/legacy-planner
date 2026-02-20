#!/usr/bin/env python3
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
AGENTS_CSV = WORKSPACE / 'licensing_db' / 'agents.csv'
LICENSES_CSV = WORKSPACE / 'licensing_db' / 'agent_licenses.csv'
CARRIERS_CSV = WORKSPACE / 'licensing_db' / 'carrier_contracts.csv'
OUT_JSON = ROOT / 'data' / 'licensedAgents.json'


def load_agents(path):
    by_id = {}
    with path.open() as f:
        for row in csv.DictReader(f):
            by_id[row['agent_id']] = row
    return by_id


def load_carriers(path):
    by_agent = {}
    if not path.exists():
        return by_agent

    for_agent = {}
    with path.open() as f:
        for row in csv.DictReader(f):
            aid = (row.get('agent_id') or '').strip()
            if not aid:
                continue
            for_agent.setdefault(aid, []).append(
                {
                    'carrier': (row.get('carrier') or '').strip(),
                    'contract_status': (row.get('contract_status') or '').strip(),
                    'carrier_agent_id': (row.get('carrier_agent_id') or '').strip()
                }
            )

    # normalize carrier lists for each agent
    for aid, items in for_agent.items():
        active = []
        all_carriers = []
        seen_all = set()
        seen_active = set()
        for item in items:
            carrier = item['carrier']
            status = item['contract_status'].lower()
            if carrier and carrier not in seen_all:
                all_carriers.append(carrier)
                seen_all.add(carrier)
            if carrier and status == 'active' and carrier not in seen_active:
                active.append(carrier)
                seen_active.add(carrier)

        by_agent[aid] = {
            'carriers_active': sorted(active),
            'carriers_all': sorted(all_carriers),
            'carrier_details': sorted(items, key=lambda x: (x['carrier'], x['contract_status']))
        }

    return by_agent


def build_rows(agents_by_id, licenses_path, carriers_by_agent):
    rows = []
    agents_with_license = set()

    with licenses_path.open() as f:
        for row in csv.DictReader(f):
            aid = row['agent_id']
            agents_with_license.add(aid)
            agent = agents_by_id.get(aid, {})
            carrier_info = carriers_by_agent.get(aid, {})
            rows.append(
                {
                    'agent_id': aid,
                    'full_name': agent.get('full_name', ''),
                    'email': agent.get('email', ''),
                    'phone': agent.get('phone', ''),
                    'city': agent.get('city', ''),
                    'home_state': agent.get('home_state', ''),
                    'state_code': row.get('state_code', ''),
                    'license_status': row.get('license_status', 'Active'),
                    'carriers_active': carrier_info.get('carriers_active', []),
                    'carriers_all': carrier_info.get('carriers_all', []),
                    'carrier_details': carrier_info.get('carrier_details', [])
                }
            )

    # Include carrier-only agents even if they do not have a state license row yet.
    for aid, carrier_info in carriers_by_agent.items():
        if aid in agents_with_license:
            continue
        agent = agents_by_id.get(aid, {})
        rows.append(
            {
                'agent_id': aid,
                'full_name': agent.get('full_name', ''),
                'email': agent.get('email', ''),
                'phone': agent.get('phone', ''),
                'city': agent.get('city', ''),
                'home_state': agent.get('home_state', ''),
                'state_code': '',
                'license_status': '',
                'carriers_active': carrier_info.get('carriers_active', []),
                'carriers_all': carrier_info.get('carriers_all', []),
                'carrier_details': carrier_info.get('carrier_details', [])
            }
        )

    rows.sort(key=lambda r: ((r.get('full_name') or '').upper(), r.get('state_code') or ''))
    return rows


def main():
    if not AGENTS_CSV.exists() or not LICENSES_CSV.exists():
        raise SystemExit('Missing licensing_db CSV files. Run from workspace with licensing_db/ present.')

    agents = load_agents(AGENTS_CSV)
    carriers = load_carriers(CARRIERS_CSV)
    rows = build_rows(agents, LICENSES_CSV, carriers)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(rows, indent=2))
    print(f'Wrote {len(rows)} rows -> {OUT_JSON}')


if __name__ == '__main__':
    main()
