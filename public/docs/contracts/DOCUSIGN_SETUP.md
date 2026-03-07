# DocuSign Setup Guide (ICA)

## 1) Template
Create template: `Legacy Link ICA v2`
- Signer 1: Agent
- Signer 2: Company Representative

## 2) Required fields
- Agent name, email, signature, date
- Company rep name/title/signature/date

## 3) Connect webhook
Configure DocuSign Connect webhook URL:
`https://innercirclelink.com/api/docusign/connect`

Optional secret header:
- Set env `DOCUSIGN_CONNECT_SECRET`
- Send same value in `x-contract-secret`

## 4) Public signing link
Set env:
`NEXT_PUBLIC_DOCUSIGN_ICA_URL=<your-docusign-recipient-or-powerform-url>`

## 5) Status check endpoint
App checks:
`GET /api/contract-signatures?email=<agent@email>`

A signed record unlocks policy app submission.

## 6) Manual admin override (if needed)
`POST /api/contract-signatures`
```json
{
  "adminToken": "<CONTRACT_ADMIN_TOKEN>",
  "email": "agent@example.com",
  "name": "Agent Name",
  "envelopeId": "abc123",
  "signedAt": "2026-03-07T12:00:00.000Z",
  "source": "manual_admin"
}
```
