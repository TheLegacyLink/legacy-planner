'use client';

function clean(v = '') {
  return String(v || '').trim();
}

export default function IulAgreementPage() {
  const docusignUrl = clean(process.env.NEXT_PUBLIC_DOCUSIGN_IUL_ICA_URL || '');

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 860 }}>
        <h2 style={{ marginTop: 0 }}>IUL Independent Contractor Agreement</h2>
        <p className="muted">
          Approved IUL candidates should complete this DocuSign agreement before onboarding.
        </p>

        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          {docusignUrl ? (
            <a className="publicPrimaryBtn" href={docusignUrl} target="_blank" rel="noreferrer">
              Open IUL DocuSign Agreement
            </a>
          ) : (
            <span className="pill atrisk">IUL DocuSign link not configured yet (NEXT_PUBLIC_DOCUSIGN_IUL_ICA_URL)</span>
          )}
        </div>

        <p className="muted" style={{ marginTop: 10 }}>
          If the button is unavailable, confirm the Vercel environment variable is set and redeploy.
        </p>
      </div>
    </main>
  );
}
