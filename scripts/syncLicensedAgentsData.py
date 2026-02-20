#!/usr/bin/env python3
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
AGENTS_CSV = WORKSPACE / 'licensing_db' / 'agents.csv'
LICENSES_CSV = WORKSPACE / 'licensing_db' / 'agent_licenses.csv'
OUT_JSON = ROOT / 'data' / 'licensedAgents.json'


def load_agents(path):
    by_id = {}
    with path.open() as f:
        for row in csv.DictReader(f):
            by_id[row['agent_id']] = row
    return by_id


def build_rows(agents_by_id, licenses_path):
    rows = []
    with licenses_path.open() as f:
        for row in csv.DictReader(f):
            agent = agents_by_id.get(row['agent_id'], {})
            rows.append(
                {
                    'agent_id': row['agent_id'],
                    'full_name': agent.get('full_name', ''),
                    'email': agent.get('email', ''),
                    'phone': agent.get('phone', ''),
                    'city': agent.get('city', ''),
                    'home_state': agent.get('home_state', ''),
                    'state_code': row.get('state_code', ''),
                    'license_status': row.get('license_status', 'Active')
                }
            )

    rows.sort(key=lambda r: ((r.get('full_name') or '').upper(), r.get('state_code') or ''))
    return rows


def main():
    if not AGENTS_CSV.exists() or not LICENSES_CSV.exists():
        raise SystemExit('Missing licensing_db CSV files. Run from workspace with licensing_db/ present.')

    agents = load_agents(AGENTS_CSV)
    rows = build_rows(agents, LICENSES_CSV)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(rows, indent=2))
    print(f'Wrote {len(rows)} rows -> {OUT_JSON}')


if __name__ == '__main__':
    main()
