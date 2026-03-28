export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { loadInnerCircleMetrics } from '../../../../lib/innerCircleMetrics';

export async function GET() {
  const data = await loadInnerCircleMetrics();
  return Response.json(data.rows);
}
