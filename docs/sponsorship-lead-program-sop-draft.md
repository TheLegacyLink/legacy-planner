# Sponsorship Lead Program SOP (Draft v1)

Owner: Kimora Link  
Program: The Legacy Link Sponsorship Lead Program  
Date: 2026-03-06

---

## 1) Program Intent

Create a clear path for sponsorship participants to receive leads based on readiness and performance, while protecting lead quality, speed-to-contact, and compliance.

---

## 2) Lead Type Clarification (Critical)

### Sponsorship Leads (this SOP)
- Referral-based program leads
- Not treated like normal commission lead product flow
- Distributed based on readiness + program status

### Marketplace Leads
- Paid lead purchases (Tier 1/Tier 2)
- Agent pays to unlock and own lead
- Separate from sponsorship fulfillment logic

---

## 3) Two Tracks: Licensed vs Unlicensed

## A) Unlicensed Track
**Status goal:** move to licensed as fast as possible.

Unlicensed participants:
- Can complete onboarding, community service, and readiness training
- **Cannot receive live sponsorship call leads until licensed**
- Can be queued in “Pending License” state

### Unlicensed SOP path
1. Sponsorship Approved
2. Onboarding Started
3. Community Service Assigned
4. Community Service Submitted
5. Community Service Approved
6. Licensing In Progress
7. **Licensed Achieved** → move to Licensed Track

---

## B) Licensed Track
Licensed participants can receive sponsorship leads when minimum readiness is met.

### Minimum readiness for lead release
- Sponsorship approved
- Licensed = yes
- Community service approved
- Onboarding complete (script + process + CRM expectations)
- Contracting status = **Started** (not necessarily fully completed, per current rule)

> Business rule confirmed: sponsorship leads do **not** require full contracting completion to begin release, as long as process is started and participant is licensed.

---

## 4) Program Tiers / Ascension Model

## Tier 0 — Sponsored Start (Free)
- Eligibility: licensed + onboarding complete + community service approved + contracting started
- Lead release: controlled starter volume
- Goal: prove speed + consistency + conversion behavior

## Tier 1 — $97
- Trigger: consistent activity + basic conversion discipline
- Increased lead flow

## Tier 2 — $497
- Trigger: stronger production and follow-up consistency
- Priority lead access

## Tier 3 — $1,200 recurring
- Target state for scale
- Example allocation: up to 60 leads/month
- Highest priority routing and support

---

## 5) Required Status Model (Automation-Ready)

Use these exact statuses in CRM/ops:

1. `SPONSORSHIP_APPROVED`
2. `ONBOARDING_STARTED`
3. `ONBOARDING_COMPLETE`
4. `COMMUNITY_SERVICE_PENDING`
5. `COMMUNITY_SERVICE_SUBMITTED`
6. `COMMUNITY_SERVICE_APPROVED`
7. `LICENSE_PENDING`
8. `LICENSED_ACTIVE`
9. `CONTRACTING_NOT_STARTED`
10. `CONTRACTING_STARTED`
11. `CONTRACTED_COMPLETE`
12. `LEAD_ACCESS_HOLD`
13. `LEAD_ACCESS_ACTIVE`
14. `PROGRAM_TIER_0`
15. `PROGRAM_TIER_1`
16. `PROGRAM_TIER_2`
17. `PROGRAM_TIER_3`

---

## 6) Lead Access Gate Logic

## Gate Rule (must pass)
`licensed_active == true`
AND `community_service_approved == true`
AND `onboarding_complete == true`
AND `contracting_started_or_complete == true`

If false:
- Keep in `LEAD_ACCESS_HOLD`
- Send missing requirement checklist

If true:
- Set `LEAD_ACCESS_ACTIVE`
- Assign tier (default Tier 0 unless manually upgraded)

---

## 7) Distribution SOP (Sponsorship Queue)

When new sponsorship lead enters queue:

1. Verify lead is eligible for sponsorship distribution (not booked, not sold in marketplace)
2. Pull eligible recipient pool from `LEAD_ACCESS_ACTIVE`
3. Filter by:
   - Current tier
   - Daily cap
   - SLA compliance history
   - Active status
4. Route by balancing rules (round-robin + performance weighting)
5. Send assignment notice + response timer
6. If no first touch in SLA window, auto-reassign

---

## 8) Compliance / Quality Controls

- Mandatory first contact SLA (ex: within 5–10 minutes)
- Minimum follow-up attempts (5–7)
- Auto reassign on non-compliance
- Full assignment and contact-attempt logging
- Admin override at all times

---

## 9) Page Blueprint Recommendation

## Keep separate pages (recommended)

### Page 1: Lead Marketplace (already live)
- Paid lead purchases
- Buyer-only unlock

### Page 2: Sponsorship Queue (new)
- For eligible sponsored participants
- No payment required at assignment time
- Tier-based allocation
- Status gate visibility (why they are/aren’t receiving leads)

### Page 3: Sponsorship Program Admin (can be in Sponsorship Ops)
- Status controls
- Tier upgrades/downgrades
- Community service verification
- Licensing/contracting verification
- Manual holds/releases

---

## 10) Automation Triggers (Phase 1)

1. **On Sponsorship Approval**
   - Set status `SPONSORSHIP_APPROVED`
   - Send onboarding checklist

2. **On Community Service Approved**
   - Update service status
   - Re-check all gate requirements

3. **On License Verified**
   - Set `LICENSED_ACTIVE`
   - Re-check gate requirements

4. **On Contracting Started**
   - Set `CONTRACTING_STARTED`
   - Re-check gate requirements

5. **On Gate Pass**
   - Set `LEAD_ACCESS_ACTIVE`
   - Assign `PROGRAM_TIER_0`
   - Add to sponsorship distribution pool

6. **On SLA Miss**
   - Auto-reassign lead
   - Log compliance strike

---

## 11) Starter KPIs

- Time to first contact
- Contact rate
- Appointment set rate
- Show rate
- Conversion to policy
- SLA adherence rate
- Tier progression velocity (0→1→2→3)

---

## 12) Next Build Sequence (Practical)

1. Add status fields and gate engine
2. Build Sponsorship Queue page (eligible users only)
3. Add auto-assign + SLA timer + reassign
4. Add tier progression rules and admin controls
5. Add weekly KPI report + upgrade recommendations

---

## Final Program Rule Snapshot

- Unlicensed = no live sponsorship lead assignment
- Licensed + community service approved + onboarding complete + contracting started = lead eligible
- Sponsorship leads remain separate from paid marketplace logic
- Everyone starts with controlled access, then graduates by performance
