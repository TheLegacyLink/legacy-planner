'use client';

import { useMemo } from 'react';

function clean(v = '') {
  return String(v || '').trim();
}

export default function ContractAgreementPage() {
  const docusignUrl = clean(process.env.NEXT_PUBLIC_DOCUSIGN_ICA_URL || '');

  const openUrl = useMemo(() => {
    if (!docusignUrl) return '';
    return docusignUrl;
  }, [docusignUrl]);

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 860 }}>
        <h2 style={{ marginTop: 0 }}>Independent Contractor Agreement (Required)</h2>
        <p className="muted">
          Sponsorship-track participants must complete the ICA e-signature before policy application submission.
        </p>

        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          {openUrl ? (
            <a className="publicPrimaryBtn" href={openUrl} target="_blank" rel="noreferrer">
              Open DocuSign Agreement
            </a>
          ) : (
            <span className="pill atrisk">DocuSign link not configured yet (NEXT_PUBLIC_DOCUSIGN_ICA_URL)</span>
          )}
        </div>

        <p className="muted" style={{ marginTop: 10 }}>
          Once DocuSign status is completed, contract signature is recorded automatically and policy submission unlocks.
        </p>
      </div>
    </main>
  );
}
