# Base44 → Legacy Link Back Office SSO Integration

## Overview

When a user is logged into Legacy Link Hub (Base44), clicking "Open Back Office"
generates a signed magic link and redirects the user directly into the correct
back office — no OTP, no code, no second login.

---

## The Endpoint (Our Side)

```
GET https://innercirclelink.com/api/start-auth/sso?token=<SIGNED_TOKEN>
```

This validates the token, creates a session, and redirects the user to:
- `/licensed-backoffice` — Licensed agents
- `/unlicensed-backoffice` — Unlicensed agents
- `/appointment-setter-backoffice` — Appointment setters

If the user hasn't signed their contract yet, they'll be sent to sign it first,
then automatically forwarded to their back office.

---

## Shared Secret (Keep Private — Do NOT Expose in Frontend Code)

```
SSO_SECRET = 1b3b95227dff9bd8e34c6d2c0ada8f8a324738204fcedd6920639c709ecbc597
```

Store this in Base44 as a **server-side environment variable** (not a public variable).

---

## Token Format

The token has two parts separated by a dot:

```
<base64url(JSON_payload)>.<hmac_sha256_hex>
```

### Payload (JSON)

```json
{
  "email": "user@example.com",
  "role": "licensed",
  "iat": 1718123456,
  "exp": 1718123756
}
```

| Field | Description |
|---|---|
| `email` | User's email address (lowercase) |
| `role` | `"licensed"` \| `"unlicensed"` \| `"setter"` |
| `iat` | Unix timestamp — issued at (seconds) |
| `exp` | Unix timestamp — expiry (issued + 300 = 5 min window) |

### Signing

```
HMAC-SHA256(base64url(payload_json), SSO_SECRET)
```

---

## JavaScript Code for Base44 (Server-Side Function)

Paste this into a Base44 **server action / backend function**:

```javascript
const crypto = require('crypto'); // or: import { createHmac } from 'crypto'

function generateSsoToken(email, role) {
  const SSO_SECRET = process.env.SSO_SECRET; // server env var
  const now = Math.floor(Date.now() / 1000);

  const payload = JSON.stringify({
    email: email.trim().toLowerCase(),
    role: role, // "licensed" | "unlicensed" | "setter"
    iat: now,
    exp: now + 300 // 5-minute window
  });

  // base64url encode (no padding, url-safe chars)
  const payloadB64 = Buffer.from(payload)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Sign
  const sig = crypto
    .createHmac('sha256', SSO_SECRET)
    .update(payloadB64)
    .digest('hex');

  const token = `${payloadB64}.${sig}`;
  return `https://innercirclelink.com/api/start-auth/sso?token=${encodeURIComponent(token)}`;
}

// Example usage:
// const url = generateSsoToken('john@example.com', 'unlicensed');
// redirect(url);
```

---

## Role Mapping

| Base44 User Type | Pass as `role` | Lands in |
|---|---|---|
| Licensed Agent | `"licensed"` | `/licensed-backoffice` |
| Unlicensed Agent | `"unlicensed"` | `/unlicensed-backoffice` |

---

## What Base44 Needs to Capture at Registration

To provision the back office account, Base44 needs to collect and send these
fields when a new user registers:

| Field | Required | Notes |
|---|---|---|
| First Name | ✅ | |
| Last Name | ✅ | |
| Email | ✅ | Used as unique identifier |
| Phone | ✅ | |
| Track Type | ✅ | `"licensed"` or `"unlicensed"` |
| Referrer Name | Optional | Who referred them |
| Home State | Optional | Used for licensing tracking |

When registration is complete in Base44, you can either:
- **Option A:** Immediately generate the magic link and redirect them to sign the ICA contract in the back office
- **Option B:** Store their info in Base44, and on first back office click we auto-provision them

---

## `/start` Page Behavior (Updated)

| Scenario | What Happens |
|---|---|
| User visits `innercirclelink.com/start` | Immediately redirected to Base44 login |
| Base44 login complete → clicks "Open Back Office" | Magic link → straight to back office |
| User hasn't signed contract yet | Sent to sign contract → then forwarded to back office |
| User has signed contract | Straight to back office — no friction |
| Token expired or invalid | Redirected back to Base44 login |

---

## Vercel Environment Variables to Set

Go to Vercel → Project Settings → Environment Variables and add:

| Variable | Value |
|---|---|
| `SSO_SECRET` | `1b3b95227dff9bd8e34c6d2c0ada8f8a324738204fcedd6920639c709ecbc597` |
| `NEXT_PUBLIC_BASE44_LOGIN_URL` | `https://legacylinkhub.com` |

---

## Testing the Token

Once Base44 sets up their end, you can test with this quick script:

```javascript
const crypto = require('crypto');
const SECRET = '1b3b95227dff9bd8e34c6d2c0ada8f8a324738204fcedd6920639c709ecbc597';
const now = Math.floor(Date.now() / 1000);
const payload = JSON.stringify({ email: 'test@test.com', role: 'unlicensed', iat: now, exp: now + 300 });
const b64 = Buffer.from(payload).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const sig = crypto.createHmac('sha256', SECRET).update(b64).digest('hex');
console.log(`https://innercirclelink.com/api/start-auth/sso?token=${encodeURIComponent(b64+'.'+sig)}`);
```

Run it in Node.js and paste the URL in your browser.
