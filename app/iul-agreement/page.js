'use client';

function clean(v = '') {
  return String(v || '').trim();
}

export default function IulAgreementPage() {
  const docusignUrl = clean(process.env.NEXT_PUBLIC_DOCUSIGN_INNER_CIRCLE_CONTRACT_URL || process.env.NEXT_PUBLIC_DOCUSIGN_IUL_ICA_URL || '');

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 860 }}>
        <h2 style={{ marginTop: 0 }}>Inner Circle Contract Agreement</h2>
        <p className="muted">
          Approved Inner Circle candidates should complete this DocuSign agreement before onboarding.
        </p>

        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          {docusignUrl ? (
            <a className="publicPrimaryBtn" href={docusignUrl} target="_blank" rel="noreferrer">
              Open Inner Circle Contract
            </a>
          ) : (
            <span className="pill atrisk">Contract link not available right now.</span>
          )}
        </div>

        <p className="muted" style={{ marginTop: 10 }}>
          Once signed, your onboarding process can move forward.
        </p>
      </div>
    </main>
  );
}
