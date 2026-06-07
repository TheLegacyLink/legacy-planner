export const dynamic = 'force-dynamic';

/**
 * GET /api/onboarding/weekly-video
 * Returns the current weekly required video. No auth required — public read.
 * Defaults to "Blind Faith" if nothing has been set by admin.
 */
import { loadJsonStoreDirect } from '../../../../lib/blobJsonStore.js';

const VIDEO_PATH = 'stores/onboarding-weekly-video.json';

const DEFAULT_VIDEO = {
  url: 'https://youtu.be/SVvU9SvCH9o',
  videoId: 'SVvU9SvCH9o',
  title: 'Blind Faith',
  updatedAt: null,
};

export async function GET() {
  try {
    const stored = await loadJsonStoreDirect(VIDEO_PATH, null);
    const video = stored || DEFAULT_VIDEO;
    return Response.json({ ok: true, video });
  } catch {
    return Response.json({ ok: true, video: DEFAULT_VIDEO });
  }
}
