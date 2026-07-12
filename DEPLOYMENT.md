# DigitalOcean deployment

Use DigitalOcean App Platform plus a DigitalOcean Managed PostgreSQL database.

## App Platform settings

Source directory:

```text
via-app-gateway-main
```

Build command:

```text
npm run db:deploy && npm run build
```

Run command:

```text
npm run start
```

The build command runs Prisma migrations against `DATABASE_URL`, generates the
Prisma client, and builds the TanStack Start server.

## Environment variables

Set these in DigitalOcean App Platform:

```env
DATABASE_URL="postgresql://..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="https://YOUR-DOMAIN.com/auth/google/callback"
GOOGLE_WORKSPACE_DOMAIN="your-company.com"
ADMIN_EMAILS="admin@your-company.com,it@your-company.com"
AUTH_SECRET="long-random-production-secret"
```

## Google Cloud settings

In the Google OAuth client, add the production redirect URI:

```text
https://YOUR-DOMAIN.com/auth/google/callback
```

If testing with the temporary DigitalOcean domain, also add:

```text
https://YOUR-APP.ondigitalocean.app/auth/google/callback
```

Then set `GOOGLE_REDIRECT_URI` to exactly the same URL you are using.

## Existing apps

The portal can add software and control who sees it. For true one-click access,
each connected app must add a portal SSO callback and stop asking VIA staff for
its own username/password after portal login.
