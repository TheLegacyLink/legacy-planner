# Financial Dashboard Spec v1 (Licensed + Inner Circle)

## Goal
Build a clean, interactive, color-coded financial dashboard that lets agents quickly understand:
1) what they have earned,
2) what is pending,
3) what is paid this month,
4) what is projected next.

Design principle: **high clarity, low clutter**.

---

## Primary Users
- **Licensed Agent (Personal View):** sees only their numbers.
- **Inner Circle Leader (Team Toggle):** can switch between **Me** and **Team** roll-up.

---

## Dashboard Structure (single-screen default)

### A) Top KPI Cards (4 cards max)
1. **All-Time Paid**
2. **All-Time Pending**
3. **This Month Paid**
4. **This Month Pending**

Optional mini-line under cards:
- **Next Payout:** date + projected amount

### B) Visuals (2 charts max)
1. **Monthly Earnings Trend** (bar/line)
2. **Income Source Breakdown** (donut)
   - Direct Sales
   - Sponsorship Bonuses
   - Overrides

### C) Action List (table/list)
- **Upcoming Payout Items** (top 10)
  - Applicant/Policy
  - Type
  - Amount
  - Status (Pending/Paid/Hold)
  - Expected date

### D) Compact Progress Strip
- **Goal Progress** (monthly AP or payout goal)
- **Projected End-of-Month**
- **Pending Aging** buckets: 0–7 / 8–14 / 15+ days

---

## UX Rules (to keep it clean)
- Max 4 KPI cards
- Max 2 charts
- One action table below charts
- Advanced details open in right-side drawer (not on main screen)
- Keep labels plain language (no internal jargon on primary UI)

---

## Color System
- **Green:** Paid
- **Yellow/Amber:** Pending
- **Blue:** Projected / In Forecast
- **Red:** At-Risk / Hold / Chargeback
- **Neutral gray:** informational labels

---

## Required Filters
- Time Range: This Month / Last 30 / YTD / Custom
- View Scope:
  - Licensed: Me only
  - Inner Circle: Me | Team
- Income Type: All / Direct / Sponsorship / Overrides

---

## Core Metrics Definitions

### Financial Totals
- **All-Time Paid:** sum of payout items marked paid (all time)
- **All-Time Pending:** sum of approved-but-unpaid payout items (all time)
- **This Month Paid:** paid where paidAt in current month
- **This Month Pending:** approved this month but unpaid

### Trend + Source
- **Monthly Earnings Trend:** paid + pending by month (toggle)
- **Income Source Breakdown:** percentages by income type for selected time range

### Projection
- **Projected EOM:**
  - conservative = current paid + current pending
  - optional model later: weighted probability by status stage

### Pending Aging
- Bucket pending items by days since approval/qualification event

---

## Interaction Model
- Clicking KPI card filters the list + charts.
- Clicking chart segment opens transaction drawer pre-filtered.
- Hover tooltips show metric formula and source count.
- CSV export from filtered table.

---

## Data Mapping to Current System (existing codebase)

## Existing Sources
1. `/api/policy-submissions`
2. `/api/sponsorship-applications`
3. `/api/payout-queue` (paid/unpaid state)
4. Session profile from `/api/licensed-backoffice/auth/me`

## Existing Fields already usable
- policy/submission: `status`, `appType`/`policyType`, `monthlyPremium`, `annualPremium`, `submittedAt`, `approvedAt`, `updatedAt`, `policyWriterName`, `referredByName`
- payout queue: `month`, `agent`, `paid`, `paidAt`, `updatedAt`

## New normalized view model (recommended)
Create one computed list in FE/BE:
`financialEvents[]` with:
- `id`
- `agent`
- `sourceType` (`direct_sales` | `sponsorship_bonus` | `override`)
- `status` (`pending` | `paid` | `hold`)
- `amount`
- `qualifiedAt`
- `paidAt`
- `expectedPayoutAt` (nullable)
- `referenceName` (applicant/policy)

This single model powers all cards/charts/table consistently.

---

## Placement in Product

### Licensed Backoffice
- Add new tab: **Financials** (default tab after login)
- Keep existing Overview/Sponsorships/Policies/Submit/Resources

### Inner Circle / Mission Control
- Reuse same component with scope toggle: `Me | Team`
- Team view can include leaderboard summary, but keep same financial card language

---

## v1 Build Plan (fast execution)

### Phase 1 (2–3 days)
- Build Financials tab UI shell
- Implement 4 KPI cards + trend chart + source donut + payout list
- Hook to existing APIs
- Add time range filter + card click filtering

### Phase 2 (1–2 days)
- Add pending aging buckets
- Add projected EOM card
- Add detail drawer + CSV export

### Phase 3 (later)
- Add override pipeline support
- Add payout date prediction logic
- Add benchmark goals by tier

---

## Acceptance Criteria
- Agent can answer in <10 seconds:
  1) How much have I been paid this month?
  2) How much is pending?
  3) What is expected next payout?
  4) Which items are causing delays?
- Dashboard remains readable on laptop without scrolling through dense blocks.
- No more than 2 charts visible at once.

---

## Optional Key Components to Add Next (if needed)
- Chargeback tracker card
- Carrier-level earnings split
- Goal pacing against target (daily run-rate)
- Notification badges for stale pending > 14 days
