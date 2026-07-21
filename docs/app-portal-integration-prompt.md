# VIA Portal application integration prompt

Use this prompt for each application that needs to connect to the VIA Portal.

```text
We are connecting this application to the VIA Portal.

Goal:
- Users sign in once with their VIA Google Workspace account through the VIA Portal.
- After sign-in, the portal shows only the applications the user is allowed to access.
- Portal admins manage which staff can see each application.
- When a user opens this application from the portal, they should not enter a separate username or password.
- The application must stop relying on local username/password login for VIA staff, except for a break-glass admin account if required.

Required changes:
1. Replace the current username/password login for VIA users with SSO from the VIA Portal.
2. Trust the VIA Portal as the identity provider/gateway for VIA users.
3. Accept a signed login handoff from the portal using one of these supported approaches:
   - Preferred: OpenID Connect / OAuth 2.0 with Google Workspace identity passed through the portal.
   - Alternative: SAML 2.0 if this application only supports SAML.
   - Temporary fallback: A short-lived signed JWT created by the portal and verified by this application.
4. Match users by email address from the verified Google Workspace account.
5. Create or link the application user profile on first successful portal login.
6. Map portal roles/access to application permissions:
   - portal user -> normal application user
   - portal admin -> application admin only if explicitly approved
7. Add a logout flow that returns the user to the VIA Portal or clearly ends the local app session.
8. Remove password reset, password change, and local registration flows for VIA staff.
9. Keep audit logs for:
   - user email
   - login time
   - portal/application used
   - role/access granted
   - failed authorization attempts

Security requirements:
- Do not store Google passwords or application passwords in the portal.
- Do not pass usernames or passwords in URLs.
- Use HTTPS only.
- Verify token signature, issuer, audience, expiry, and email verification before creating a session.
- Tokens must be short-lived.
- If a user is removed from portal access, they must lose access to this application.

Information we need from this application:
- Application name
- Production URL
- Staging/test URL
- Current login method
- Supported SSO methods: OIDC, OAuth 2.0, SAML, or custom JWT
- User identifier field, preferably email
- Roles/permission model
- Logout URL
- Technical contact

Expected result:
When a VIA user goes to the portal, signs in with Google Workspace, and clicks this app, they land inside the app already authenticated with the correct permissions. No extra username or password is requested.
```

## Direct URL behavior

If a staff member opens the application URL directly while not signed into that app, the app must immediately redirect them to the VIA Portal.

Use this redirect:

```text
https://portal.via-int.com/auth/google?returnTo=ENCODED_APP_URL
```

Example:

```text
https://portal.via-int.com/auth/google?returnTo=https%3A%2F%2Ftender.via-int.com%2Fdashboard
```

After Google sign-in, the portal will verify the user has access to that app and redirect back to the original app URL with a short-lived token:

```text
https://tender.via-int.com/dashboard?portal_token=SIGNED_TOKEN
```

The app must verify `portal_token`, create a local app session, remove the token from the visible URL, and continue to the dashboard.

## Portal SSO token contract

The portal sends an `HS256` signed JWT in the `portal_token` query parameter.

Claims:

```json
{
  "iss": "via-portal",
  "aud": "app-slug",
  "email": "staff@via-int.com",
  "name": "Staff Name",
  "appSlug": "app-slug",
  "iat": 1234567890,
  "exp": 1234568010
}
```

Verification requirements:

- Verify the signature with `PORTAL_SSO_SECRET`.
- Verify `iss` is `via-portal`.
- Verify `aud` matches this app's slug.
- Verify `exp` has not passed.
- Match or create the local user by `email`.
- Start the app's normal server-side session.
- Redirect to the same page without `portal_token` in the URL.

Direct app login rule:

- If no local session exists, redirect to the portal.
- Do not show username/password login to VIA staff.
- Keep only a separate emergency admin login if required.

## VIA CV Tool settings

Use these exact values for the VIA CV Tool:

| Field | Value |
| --- | --- |
| Application name | VIA CV Tool |
| Production URL | `https://cvtool.via-int.com` |
| Allowed origin | `https://cvtool.via-int.com` |
| Callback URL | `https://cvtool.via-int.com/dashboard` |
| App slug | `via-cv` |
| Audience | `via-cv` |
| Issuer | `via-portal` |
| JWT algorithm | `HS256` |
| Allowed email domain | `via-int.com` |

Expected token claims for VIA CV Tool:

```json
{
  "iss": "via-portal",
  "aud": "via-cv",
  "appSlug": "via-cv",
  "email": "user@via-int.com",
  "name": "User Name",
  "role": "user",
  "exp": 1234567890
}
```

## Recommended integration model

Use Google Workspace as the source of identity and the VIA Portal as the access gateway.

The portal should:
- Authenticate the user with Google Workspace.
- Store the user profile and app access rules.
- Show only applications the user is allowed to open.
- Send the user to each app using an SSO handoff.

Each connected app should:
- Trust the SSO handoff.
- Match the verified email to a local user.
- Create the local user if approved.
- Apply app-specific permissions based on portal access.
- Disable local passwords for VIA staff.

## Data to collect for every app

| Field | Example |
| --- | --- |
| Application name | Tender CV |
| Slug | tender-cv |
| URL | https://tender.example.com |
| Description | Manage tender submissions and CVs |
| SSO support | OIDC |
| User match field | email |
| Roles | user, admin |
| Owner | IT / department owner |
| Status | active |

## Portal implementation notes

The existing Prisma schema already includes:
- `User`
- `Account`
- `Session`
- `Application`
- `UserAppAccess`

That means the portal can support:
- Google Workspace login
- an application catalog
- per-user application access
- role-based access for each application

The next engineering step is to wire Google authentication into the portal and replace the static app list with applications loaded from the database.
