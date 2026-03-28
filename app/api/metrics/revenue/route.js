export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { loadInnerCircleMetrics } from '../../../../lib/innerCircleMetrics';

export async function GET() {
  const data = await loadInnerCircleMetrics();
  const rows = (data.rows || []).map((r) => ({
    agent_name: r.agent_name,
    activity_bonus: r.activity_bonus,
    activity_bonus_month: r.activity_bonus_month,
    activity_bonus_ytd: r.activity_bonus_ytd,
    activity_bonus_all_time: r.activity_bonus_all_time,
    referral_count: r.referral_count,
    referral_count_month: r.referral_count_month,
    referral_count_ytd: r.referral_count_ytd,
    referral_count_all_time: r.referral_count_all_time,
    app_submitted_count: r.app_submitted_count,
    app_submitted_count_month: r.app_submitted_count_month,
    app_submitted_count_ytd: r.app_submitted_count_ytd,
    app_submitted_count_all_time: r.app_submitted_count_all_time
  }));

  return Response.json(rows);
}
