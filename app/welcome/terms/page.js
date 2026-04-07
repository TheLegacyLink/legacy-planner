export default function TermsPage() {
  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 900 }}>
        <h1>Terms & Conditions</h1>
        <p className="muted">Last updated: March 23, 2026</p>
        <p>
          By using Link Leads, you agree to these terms. Orders are for business use by licensed insurance professionals
          and approved teams.
        </p>
        <h3>Account Responsibility</h3>
        <ul>
          <li>You are responsible for securing your login credentials.</li>
          <li>You agree to provide accurate account and payment information.</li>
          <li>Accounts may be limited or suspended for abuse, fraud, or policy violations.</li>
        </ul>
        <h3>Orders & Delivery</h3>
        <ul>
          <li>Lead pricing varies by type and inventory conditions.</li>
          <li>All sales are final except as covered in the Lead Replacement Policy.</li>
          <li>Leads are delivered to the purchasing account for authorized business use only.</li>
        </ul>
        <h3>Compliance</h3>
        <ul>
          <li>You agree to comply with applicable TCPA, DNC, and state/federal regulations.</li>
          <li>Improper lead use may result in account removal.</li>
        </ul>
      </div>
    </main>
  );
}
