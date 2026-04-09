import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const SETTINGS_PATH = 'stores/fb-leads-settings.json';

const DEFAULT_SETTINGS = {
  autoDistribute: false,
  autoDistributeMode: 'balanced',
  autoDistributeAgents: ['Leticia Wright', 'Andrea Cannon'],
  autoDistributeCaps: {}
};

export async function GET() {
  try {
    const settings = await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS);
    return Response.json({ ok: true, settings: { ...DEFAULT_SETTINGS, ...settings } });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || 'load_failed') },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const current = await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS);
    const updated = {
      ...DEFAULT_SETTINGS,
      ...current,
      autoDistribute: typeof body.autoDistribute === 'boolean' ? body.autoDistribute : current.autoDistribute,
      autoDistributeMode: typeof body.autoDistributeMode === 'string' ? body.autoDistributeMode : current.autoDistributeMode,
      autoDistributeAgents: Array.isArray(body.autoDistributeAgents) ? body.autoDistributeAgents : current.autoDistributeAgents,
      autoDistributeCaps: (body.autoDistributeCaps && typeof body.autoDistributeCaps === 'object' && !Array.isArray(body.autoDistributeCaps)) ? body.autoDistributeCaps : (current.autoDistributeCaps || {})
    };

    await saveJsonFile(SETTINGS_PATH, updated);
    return Response.json({ ok: true, settings: updated });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || 'save_failed') },
      { status: 500 }
    );
  }
}
