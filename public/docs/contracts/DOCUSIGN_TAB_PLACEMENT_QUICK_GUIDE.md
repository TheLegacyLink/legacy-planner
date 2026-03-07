# DocuSign Quick Guide — ICA Company-Signer Template

Use file: `ICA_v2_COMPANY_SIGNER_FOR_DOCUSIGN.pdf`

## Recipients (Template)
1. **Agent** (Signer, routing order 1)
2. **Company Representative** (Signer, routing order 2)

Turn on signing order.

## Required tabs for Agent (Signer 1)
Place on signature page under AGENT SIGNATURE block:
- SignHere (Agent Signature line)
- DateSigned (Date line)
- FullName (Agent Name line)
- Email (Agent Email line)

## Required tabs for Company Representative (Signer 2)
Place on signature page under COMPANY SIGNATURE block:
- SignHere (Company Signature line)
- DateSigned (Date line)
- FullName (Authorized Representative line)
- Title (Title line)

## PowerForm notes
- Keep Agent dynamic.
- Keep Company Representative pre-filled (name+email) so every envelope can countersign automatically.

## Webhook
DocuSign Connect URL:
`https://innercirclelink.com/api/docusign/connect`

If custom headers are available, include:
- `x-contract-secret: <same value as DOCUSIGN_CONNECT_SECRET>`
