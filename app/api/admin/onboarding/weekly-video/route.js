export const dynamic = 'force-dynamic';

/**
 * GET  /api/admin/onboarding/weekly-video — get current video
 * POST /api/admin/onboarding/weekly-video — update weekly video (admin only)
 */
import { loadJsonStoreDirect, saveJsonStoreDirect } from '../../../../../lib/blobJsonStore.js';
import { resolveAdminSession } from '../../../../../lib/onboardingAdminAuth.js';

const VIDEO_PATH = 'stores/onboarding-weekly-video.json';

const DEFAULT_VIDEO = {
  url: 'https://youtu.be/SVvU9SvCH9o',
  videoId: 'SVvU9SvCH9o',
  title: 'Blind Faith',
  updatedAt: null,
};

function extractVideoId(url = '') {
  // Handle youtu.be/ID and youtube.com/watch?v=ID formats
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  const long = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (long) return long[1];
  // If they paste just the ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export async function GET(req) {
  const admin = await resolveAdminSession(req);
  if (!admin) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const stored = await loadJsonStoreDirect(VIDEO_PATH, null);
  return Response.json({ ok: true, video: stored || DEFAULT_VIDEO });
}

export async function POST(req) {
  const admin = await resolveAdminSession(req);
  if (!admin) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url = String(body.url || '').trim();
  const title = String(body.title || '').trim() || 'Weekly Video';

  if (!url) return Response.json({ ok: false, error: 'url_required' }, { status: 400 });

  const videoId = extractVideoId(url);
  if (!videoId) return Response.json({ ok: false, error: 'invalid_youtube_url' }, { status: 400 });

  const video = {
    url: `https://youtu.be/${videoId}`,
    videoId,
    title,
    updatedAt: new Date().toISOString(),
    updatedBy: admin.email,
  };

  await saveJsonStoreDirect(VIDEO_PATH, video);
  return Response.json({ ok: true, video });
}
