export default function LeadReplacementPolicyPage() {
  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 980 }}>
        <h1>Lead Purchase + Replacement Policy</h1>
        <p className="muted">Last updated: March 23, 2026</p>

        <p>
          The Legacy Link is committed to providing every agent with quality leads. By purchasing leads from
          The Legacy Link / Link Leads, you understand and agree that all sales are final.
          You waive your right to a refund and you waive your right to dispute lead charges for any reason.
          By purchasing leads, you acknowledge you understand and agree to this policy.
        </p>

        <p>
          Our goal is to provide agents with the best possible leads at the best possible price.
          AI-assisted validation is used in the lead replacement process to improve speed and consistency.
        </p>

        <h3>Replacement Submission Window</h3>
        <p>
          <strong>All lead replacement requests must be submitted within 72 hours</strong> of order fulfillment.
        </p>

        <h3>Eligible for Replacement</h3>
        <ul>
          <li>Disconnected phone numbers (AI validation)</li>
          <li>Duplicate lead received within 60 days</li>
          <li>Lead is older than 85, when date of birth exists (AI validation)</li>
          <li>Lead delivered outside purchased geographic territory (AI validation)</li>
          <li>
            Lead already sold by an agent who purchased from us
            (AI checks matching phone number + SOLD status)
          </li>
        </ul>

        <h3>Not Eligible for Replacement</h3>
        <ul>
          <li>Unresponsive numbers (no answers / voicemails)</li>
          <li>Wrong numbers / wrong info</li>
          <li>Duplicate leads received more than 60 days apart</li>
          <li>FREE leads</li>
          <li>Any OTP (SMS verified) lead unless aged 45+ days</li>
        </ul>

        <h3>How to Request a Replacement</h3>
        <p>
          Email <a href="mailto:Support@thelegacylink.com">Support@thelegacylink.com</a> within the 72-hour window and include:
        </p>
        <ul>
          <li>Order ID</li>
          <li>Lead details (name/phone/email)</li>
          <li>Reason for replacement request</li>
          <li>Any relevant outreach notes/screenshots</li>
        </ul>

        <p>
          We apologize for any inconvenience. To keep lead quality high, pricing competitive,
          and delivery standards consistent, this policy is applied to every lead order.
          Thank you for your continued support.
        </p>
      </div>
    </main>
  );
}
