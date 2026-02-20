#!/usr/bin/env python3
import argparse
import json
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

NS = {
    'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}

STATE_TO_CODE = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
    'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'DISTRICT OF COLUMBIA': 'DC',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL',
    'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA',
    'MAINE': 'ME', 'MARYLAND': 'MD', 'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN',
    'MISSISSIPPI': 'MS', 'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK', 'OREGON': 'OR',
    'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD',
    'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT', 'VIRGINIA': 'VA',
    'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
}


def parse_date(value: str) -> str:
    value = (value or '').strip()
    if not value:
        return ''
    for fmt in ('%m-%d-%Y', '%m/%d/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(value, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return ''


def parse_float(value: str):
    value = (value or '').replace(',', '').replace('$', '').strip()
    if value == '':
        return None
    try:
        return float(value)
    except ValueError:
        return None


def normalize_state(value: str):
    v = (value or '').strip().upper()
    if len(v) == 2:
        return v
    return STATE_TO_CODE.get(v, '')


def read_xlsx_rows(path: Path):
    with zipfile.ZipFile(path) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall('a:si', NS):
                shared.append(''.join(t.text or '' for t in si.findall('.//a:t', NS)))

        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rid_to_target = {r.attrib['Id']: r.attrib['Target'] for r in rels}

        sheet = wb.find('a:sheets/a:sheet', NS)
        rid = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = 'xl/' + rid_to_target[rid].lstrip('/')
        ws = ET.fromstring(z.read(target))

        def cell_value(c):
            t = c.attrib.get('t')
            v = c.find('a:v', NS)
            if v is None:
                isel = c.find('a:is', NS)
                if isel is not None:
                    return ''.join(t.text or '' for t in isel.findall('.//a:t', NS))
                return ''
            raw = v.text or ''
            if t == 's':
                try:
                    return shared[int(raw)]
                except Exception:
                    return raw
            return raw

        rows = []
        for row in ws.findall('.//a:sheetData/a:row', NS):
            rows.append([cell_value(c) for c in row.findall('a:c', NS)])
        return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, help='Path to F&G xlsx')
    parser.add_argument('--output', required=True, help='Output json path')
    args = parser.parse_args()

    rows = read_xlsx_rows(Path(args.input))

    report_date = ''
    header_idx = None
    header = []

    for i, row in enumerate(rows):
        if row and row[0] == 'Date of Report:':
            report_date = parse_date(row[1] if len(row) > 1 else '')
        if 'Policy Number' in row and 'Writing Agent Name' in row:
            header_idx = i
            header = row
            break

    if header_idx is None:
        raise SystemExit('Could not find policy header row')

    col = {name: idx for idx, name in enumerate(header)}
    required = ['Writing Agent Name', 'Writing Agent Number', 'Policy Number', 'Policy Status', 'Policy Effective Date', 'Policy Issued Date', 'Modal Premium', 'Issued State', 'Payment Mode', 'Owner Name']
    for r in required:
        if r not in col:
            raise SystemExit(f'Missing required column: {r}')

    policies_by_number = {}

    for row in rows[header_idx + 1:]:
        if len(row) < len(header):
            row = row + [''] * (len(header) - len(row))

        policy_number = row[col['Policy Number']].strip()
        if not policy_number:
            continue

        policy = {
            'policy_number': policy_number,
            'writing_agent_name': row[col['Writing Agent Name']].strip(),
            'writing_agent_number': row[col['Writing Agent Number']].strip(),
            'writing_agent_email': row[col.get('Writing Agent Email', '')].strip() if 'Writing Agent Email' in col else '',
            'policy_status': row[col['Policy Status']].strip(),
            'policy_status_norm': row[col['Policy Status']].strip().lower(),
            'product_type': row[col.get('Product Type', '')].strip() if 'Product Type' in col else '',
            'product_name': row[col.get('Product Name', '')].strip() if 'Product Name' in col else '',
            'policy_issued_date': parse_date(row[col['Policy Issued Date']]),
            'policy_effective_date': parse_date(row[col['Policy Effective Date']]),
            'first_premium_payment_date': parse_date(row[col.get('First Premium Payment Date', '')]) if 'First Premium Payment Date' in col else '',
            'issued_state': row[col['Issued State']].strip(),
            'issued_state_code': normalize_state(row[col['Issued State']]),
            'payment_mode': row[col['Payment Mode']].strip(),
            'owner_name': row[col['Owner Name']].strip(),
            'owner_phone': row[col.get('Owner Phone', '')].strip() if 'Owner Phone' in col else '',
            'owner_email': row[col.get('Owner Email', '')].strip() if 'Owner Email' in col else '',
            'modal_premium': parse_float(row[col['Modal Premium']]),
            'current_account_value': parse_float(row[col.get('Current Account Value', '')]) if 'Current Account Value' in col else None,
            'total_premium_paid': parse_float(row[col.get('Total Premium Paid', '')]) if 'Total Premium Paid' in col else None,
            'report_date': report_date,
            'source_carrier': 'F&G'
        }

        # Keep latest issued date if duplicates exist
        old = policies_by_number.get(policy_number)
        if not old:
            policies_by_number[policy_number] = policy
        else:
            old_date = old.get('policy_issued_date') or ''
            new_date = policy.get('policy_issued_date') or ''
            if new_date > old_date:
                policies_by_number[policy_number] = policy

    output = sorted(policies_by_number.values(), key=lambda x: ((x.get('policy_issued_date') or ''), x['policy_number']), reverse=True)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2))

    print(f'policies={len(output)}')
    statuses = {}
    for p in output:
        statuses[p['policy_status']] = statuses.get(p['policy_status'], 0) + 1
    print('statuses=', statuses)


if __name__ == '__main__':
    main()
