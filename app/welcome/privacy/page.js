export default function PrivacyPolicyPage() {
  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 900 }}>
        <h1>Privacy Policy</h1>
        <p className="muted">Last updated: March 23, 2026</p>
        <p>
          Link Leads and The Legacy Link collect account, order, and lead-delivery data to operate the marketplace,
          process payments, and provide customer support.
        </p>
        <h3>What We Collect</h3>
        <ul>
          <li>Account details (name, email, role)</li>
          <li>Order records (lead type, quantity, amount paid, timestamps)</li>
          <li>Lead-delivery activity and marketplace access logs</li>
        </ul>
        <h3>How We Use Data</h3>
        <ul>
          <li>Authenticate users and secure account access</li>
          <li>Process payments and maintain purchase history</li>
          <li>Route purchased leads to the correct account</li>
          <li>Provide support, compliance, and fraud prevention</li>
        </ul>
        <h3>Contact</h3>
        <p>
          Support@thelegacylink.com<br />
          201-862-7040<br />
          340 Old River Road, Edgewater NJ 07020
        </p>
      </div>
    </main>
  );
}
