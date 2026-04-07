import json
import re
import urllib.parse
import urllib.request


def get(url):
    return json.load(urllib.request.urlopen(url))


def post(url, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    return json.load(urllib.request.urlopen(req))


def norm(s):
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def clean(s):
    return str(s or '').strip()

claims = get('https://innercirclelink.com/api/lead-claims?viewer=' + urllib.parse.quote('Andrea Cannon')).get('rows', [])
bookings = get('https://innercirclelink.com/api/sponsorship-bookings').get('rows', [])
apps = get('https://innercirclelink.com/api/sponsorship-applications').get('rows', [])

booking_by_id = {clean(r.get('id')): r for r in bookings if clean(r.get('id'))}
app_by_id = {clean(r.get('id')): r for r in apps if clean(r.get('id'))}

exclude_keywords = ['booked', 'approved', 'declin', 'completed', 'contract signed', 'payment received', 'onboarding pending', 'onboarding_complete']

eligible = []
for c in claims:
    sid = clean(c.get('source_application_id'))
    app = app_by_id.get(sid, {})
    status = norm(app.get('status'))
    if any(k in status for k in exclude_keywords):
        continue
    cstatus = norm(c.get('claim_status'))
    if cstatus.startswith('claimed') or cstatus.startswith('invalid'):
        continue

    full = booking_by_id.get(clean(c.get('id')), {})
    row = {
        'id': clean(c.get('id')),
        'source_application_id': sid,
        'full_name': clean(full.get('applicant_name') or c.get('applicant_name')),
        'phone': clean(full.get('applicant_phone') or c.get('applicant_phone')),
        'email': clean(full.get('applicant_email') or c.get('applicant_email')),
        'state': clean(full.get('applicant_state') or c.get('applicant_state')),
        'requested_at_est': clean(full.get('requested_at_est') or c.get('requested_at_est')),
        'licensed_status': clean(full.get('licensed_status') or c.get('licensed_status')),
        'referred_by': clean(full.get('referred_by') or c.get('referred_by')),
        'claim_status': clean(c.get('claim_status')),
        'dob': clean(app.get('dateOfBirth') or app.get('dob') or app.get('birthDate') or app.get('birthday')),
        'app_status': clean(app.get('status')),
    }
    eligible.append(row)

eligible = sorted(eligible, key=lambda x: (x['requested_at_est'], x['full_name']))
andrea, leticia = [], []
for i, r in enumerate(eligible):
    (andrea if i % 2 == 0 else leticia).append(r)


def format_leads(rows):
    lines = []
    for i, r in enumerate(rows, 1):
        lines.append(
            f"{i}. {r['full_name']}\n"
            f"   Phone: {r['phone'] or 'N/A'}\n"
            f"   Email: {r['email'] or 'N/A'}\n"
            f"   DOB: {r['dob'] or 'Not provided'}\n"
            f"   State: {r['state'] or 'N/A'}\n"
            f"   Requested Appt: {r['requested_at_est'] or 'N/A'}\n"
            f"   Licensed Status: {r['licensed_status'] or 'N/A'}\n"
            f"   Referred By: {r['referred_by'] or 'N/A'}\n"
            f"   Source App ID: {r['source_application_id'] or 'N/A'}\n"
            f"   Booking ID: {r['id'] or 'N/A'}"
        )
    return '\n\n'.join(lines)

common_header = (
    'Hi {name},\n\n'
    'As requested, here is your non-overlapping lead list for this week with full available prospect details.\n'
    'Please begin outreach immediately and update outcomes in Mission Control.\n\n'
)

andrea_text = (
    common_header.format(name='Andrea')
    + f"Total Leads Assigned: {len(andrea)}\n\n"
    + format_leads(andrea)
    + '\n\nBest regards,\nLegacy Link Support Team\n'
)

leticia_text = (
    common_header.format(name='Leticia')
    + f"Total Leads Assigned: {len(leticia)}\n\n"
    + format_leads(leticia)
    + '\n\nBest regards,\nLegacy Link Support Team\n'
)

res1 = post('https://innercirclelink.com/api/manual-email', {
    'to': 'andreadcannon@gmail.com',
    'cc': 'investalinkinsurance@gmail.com',
    'subject': 'Your Lead Assignment List (Andrea Cannon)',
    'text': andrea_text
})

res2 = post('https://innercirclelink.com/api/manual-email', {
    'to': 'leticiawright05@gmail.com',
    'cc': 'investalinkinsurance@gmail.com',
    'subject': 'Your Lead Assignment List (Leticia Wright)',
    'text': leticia_text
})

print(json.dumps({
    'summary': {
        'total_visible': len(claims),
        'eligible_after_filter': len(eligible),
        'andrea_count': len(andrea),
        'leticia_count': len(leticia)
    },
    'andrea_email': res1,
    'leticia_email': res2
}, indent=2))
