'use client';

const pageWrap = {
  minHeight: '100vh',
  background: 'radial-gradient(1100px 520px at 8% -8%, rgba(59,130,246,.25), transparent 58%), radial-gradient(900px 480px at 95% 4%, rgba(200,169,107,.18), transparent 55%), #020617',
  padding: 16,
  color: '#F8FAFC'
};

export default function StartPortalPage() {
  return (
    <main style={pageWrap}>
      <div style={{ maxWidth: 940, margin: '32px auto', border: '1px solid #1F2A44', borderRadius: 18, background: 'linear-gradient(180deg,#081124 0%,#070d1c 100%)', padding: 22 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 36 }}>✨</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 40, lineHeight: 1.1 }}>Start Your Legacy Link Profile</h1>
          <p style={{ margin: '8px 0 0', color: '#9FB3CC', fontSize: 16 }}>Choose your route to continue onboarding.</p>
        </div>

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
          <a href="/start/licensed" style={{ textDecoration: 'none', color: '#F8FAFC', border: '1px solid #334155', borderRadius: 16, background: '#0B1220', padding: 18, display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '.05em', color: '#93C5FD', fontWeight: 700 }}>Licensed Route</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>I’m a Licensed Agent</div>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: 14 }}>NPN + licensed states required for compliance intake.</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#CBD5E1', fontSize: 14, lineHeight: 1.5 }}>
              <li>Full producer profile capture</li>
              <li>Ready for credential provisioning</li>
            </ul>
            <span style={{ marginTop: 6, display: 'inline-block', alignSelf: 'start', borderRadius: 999, border: '1px solid #475569', padding: '6px 12px', fontWeight: 700 }}>Continue Licensed →</span>
          </a>

          <a href="/start/unlicensed" style={{ textDecoration: 'none', color: '#F8FAFC', border: '1px solid #334155', borderRadius: 16, background: '#0B1220', padding: 18, display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '.05em', color: '#86EFAC', fontWeight: 700 }}>Unlicensed Route</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>I’m Not Licensed Yet</div>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: 14 }}>Quick intake to begin onboarding and next-step setup.</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#CBD5E1', fontSize: 14, lineHeight: 1.5 }}>
              <li>Fast contact profile</li>
              <li>Licensing/onboarding guidance path</li>
            </ul>
            <span style={{ marginTop: 6, display: 'inline-block', alignSelf: 'start', borderRadius: 999, border: '1px solid #475569', padding: '6px 12px', fontWeight: 700 }}>Continue Unlicensed →</span>
          </a>
        </div>

        <p style={{ marginTop: 16, color: '#94A3B8', textAlign: 'center', fontSize: 13 }}>Used the old app before? Submit once here to sync into the new system.</p>
      </div>
    </main>
  );
}
