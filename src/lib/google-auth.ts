import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type AuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
  allowedDomain?: string;
  adminEmails: string[];
};

export type PortalSession = {
  email: string;
  name?: string;
  picture?: string;
  hd?: string;
  exp: number;
};

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenInfo = {
  aud?: string;
  iss?: string;
  exp?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  hd?: string;
  error?: string;
  error_description?: string;
};

const sessionCookieName = "via_portal_session";
const stateCookieName = "via_google_oauth_state";
const sessionMaxAgeSeconds = 60 * 60 * 8;

let loadedLocalEnv = false;

export function isAuthRoute(pathname: string) {
  return pathname === "/auth/signin" ||
    pathname === "/auth/google" ||
    pathname === "/auth/google/callback" ||
    pathname === "/auth/signout" ||
    pathname === "/auth/session";
}

export async function handleAuthRoute(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/auth/signin") {
    return renderSignInPage(request);
  }

  if (url.pathname === "/auth/google") {
    return startGoogleSignIn(request);
  }

  if (url.pathname === "/auth/google/callback") {
    return completeGoogleSignIn(request);
  }

  if (url.pathname === "/auth/signout") {
    return redirect("/", [
      serializeCookie(sessionCookieName, "", {
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "Lax",
        secure: isSecureRequest(request),
      }),
    ]);
  }

  if (url.pathname === "/auth/session") {
    const session = getPortalSession(request);
    return Response.json({ user: session ? toPublicSession(session) : null });
  }

  return new Response("Not found", { status: 404 });
}

export function getPortalSession(request: Request): PortalSession | null {
  const config = getOptionalAuthConfig(request);
  if (!config) return null;

  const rawCookie = getCookie(request, sessionCookieName);
  if (!rawCookie) return null;

  const [encodedPayload, signature] = rawCookie.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signValue(encodedPayload, config.sessionSecret);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const session = JSON.parse(base64UrlDecode(encodedPayload)) as PortalSession;
    if (!session.email || !session.exp || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function renderSignInPage(request: Request) {
  const config = getOptionalAuthConfig(request);
  const missingConfig = !config;
  const allowedDomain = config?.allowedDomain;

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VIA Portal - Sign in</title>
    <style>
      :root {
        color-scheme: light;
        --via-blue: #0f5b99;
        --via-blue-dark: #073e73;
        --via-green: #079a4a;
        --via-red: #e92824;
        --ink: #08172f;
        --muted: #63708a;
        --line: #dbe5f2;
        --panel: #ffffff;
        --wash: #f5f8fc;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          linear-gradient(120deg, rgba(15, 91, 153, 0.06) 0%, rgba(255,255,255,0) 42%),
          linear-gradient(180deg, #ffffff 0%, var(--wash) 100%);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(360px, 500px);
      }
      .brand-panel {
        min-height: 100vh;
        padding: clamp(32px, 5vw, 72px);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border-right: 1px solid var(--line);
        background:
          linear-gradient(180deg, rgba(255,255,255,0.9), rgba(245,248,252,0.9)),
          repeating-linear-gradient(90deg, rgba(15,91,153,0.06) 0 1px, transparent 1px 96px);
      }
      .logo {
        width: min(360px, 72vw);
        height: auto;
        display: block;
      }
      .brand-copy {
        max-width: 620px;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--via-blue);
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .eyebrow::before {
        content: "";
        width: 34px;
        height: 3px;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--via-green), var(--via-red));
      }
      h1.brand-title {
        margin: 24px 0 0;
        max-width: 720px;
        font-size: clamp(42px, 6vw, 86px);
        line-height: 0.98;
        letter-spacing: 0;
        color: var(--ink);
      }
      .brand-note {
        margin-top: 22px;
        max-width: 520px;
        color: var(--muted);
        font-size: 17px;
        line-height: 1.65;
      }
      .status-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .status-pill {
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255,255,255,0.68);
        color: var(--muted);
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 700;
      }
      .signin-panel {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 28px;
      }
      main {
        width: min(100%, 390px);
      }
      .card {
        border: 1px solid var(--line);
        border-radius: 10px;
        background: rgba(255,255,255,0.92);
        padding: 30px;
        box-shadow: 0 24px 80px rgba(8, 23, 47, 0.12);
      }
      .small-logo {
        width: 132px;
        height: auto;
        display: none;
        margin-bottom: 30px;
      }
      h2 {
        margin: 0;
        font-size: 28px;
        line-height: 1.08;
        letter-spacing: 0;
      }
      p {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.7;
        margin: 12px 0 0;
      }
      a.button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        height: 48px;
        margin-top: 26px;
        border-radius: 9px;
        background: var(--via-blue);
        color: #ffffff;
        text-decoration: none;
        font-size: 14px;
        font-weight: 700;
        box-shadow: 0 16px 34px rgba(15, 91, 153, 0.24);
      }
      a.button:hover { background: var(--via-blue-dark); }
      .g {
        display: inline-grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        background: #ffffff;
        color: var(--via-blue);
        font-weight: 800;
      }
      .notice {
        margin-top: 24px;
        border-radius: 9px;
        border: 1px solid #f1c5c0;
        background: #fff6f5;
        color: #8c2f26;
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.5;
      }
      .domain {
        margin-top: 20px;
        color: var(--via-green);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .fine-print {
        margin-top: 18px;
        font-size: 12px;
        color: #8a94a8;
      }
      @media (max-width: 900px) {
        .shell { grid-template-columns: 1fr; }
        .brand-panel { display: none; }
        .signin-panel { min-height: 100vh; }
        .small-logo { display: block; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="brand-panel">
        <img class="logo" src="/via-logo.png" alt="VIA International" />
        <div class="brand-copy">
          <div class="eyebrow">Internal workspace</div>
          <h1 class="brand-title">One clear path to every VIA system.</h1>
          <p class="brand-note">Secure access for approved teams, designed for focused work.</p>
        </div>
        <div class="status-row">
          <div class="status-pill">Google Workspace</div>
          <div class="status-pill">Staff access</div>
          <div class="status-pill">Single sign-on</div>
        </div>
      </section>
      <section class="signin-panel">
        <main>
          <img class="small-logo" src="/via-logo.png" alt="VIA International" />
          <div class="card">
            <h2>Welcome back.</h2>
            <p>Continue with your VIA Workspace account.</p>
            ${
              missingConfig
                ? `<div class="notice">Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and AUTH_SECRET.</div>`
                : `<a class="button" href="/auth/google"><span class="g">G</span>Continue with Google</a>`
            }
            ${allowedDomain ? `<div class="domain">${escapeHtml(allowedDomain)}</div>` : ""}
            <p class="fine-print">Protected portal for VIA International staff.</p>
          </div>
        </main>
      </section>
    </div>
  </body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    },
  );
}

async function startGoogleSignIn(request: Request) {
  const config = getAuthConfig(request);
  const state = randomBytes(24).toString("base64url");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  if (config.allowedDomain) {
    authUrl.searchParams.set("hd", config.allowedDomain);
  }

  return redirect(authUrl.toString(), [
    serializeCookie(stateCookieName, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "Lax",
      secure: isSecureRequest(request),
    }),
  ]);
}

async function completeGoogleSignIn(request: Request) {
  const config = getAuthConfig(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = getCookie(request, stateCookieName);

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return new Response("Invalid Google sign-in state.", { status: 400 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });

  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenPayload.id_token) {
    return new Response(
      tokenPayload.error_description ?? tokenPayload.error ?? "Google token exchange failed.",
      { status: 401 },
    );
  }

  let user: Awaited<ReturnType<typeof verifyGoogleIdentity>>;
  try {
    user = await verifyGoogleIdentity(tokenPayload.id_token, config);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Google sign-in failed.", {
      status: 401,
    });
  }
  const now = Math.floor(Date.now() / 1000);
  const session: PortalSession = {
    email: user.email,
    name: user.name,
    picture: user.picture,
    hd: user.hd,
    exp: now + sessionMaxAgeSeconds,
  };
  const encodedSession = base64UrlEncode(JSON.stringify(session));
  const signedSession = `${encodedSession}.${signValue(encodedSession, config.sessionSecret)}`;

  return redirect("/", [
    serializeCookie(sessionCookieName, signedSession, {
      httpOnly: true,
      maxAge: sessionMaxAgeSeconds,
      path: "/",
      sameSite: "Lax",
      secure: isSecureRequest(request),
    }),
    serializeCookie(stateCookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "Lax",
      secure: isSecureRequest(request),
    }),
  ]);
}

async function verifyGoogleIdentity(idToken: string, config: AuthConfig) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  const payload = (await response.json()) as GoogleTokenInfo;

  if (!response.ok || payload.error) {
    throw new Error(payload.error_description ?? payload.error ?? "Google identity verification failed.");
  }

  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  if (payload.aud !== config.clientId || !emailVerified || !payload.email) {
    throw new Error("Google identity token is not valid for this portal.");
  }

  if (config.allowedDomain && payload.hd !== config.allowedDomain) {
    throw new Error(`Only ${config.allowedDomain} Google Workspace accounts can use this portal.`);
  }

  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    hd: payload.hd,
  };
}

function getAuthConfig(request: Request): AuthConfig {
  const config = getOptionalAuthConfig(request);
  if (!config) {
    throw new Error("Google sign-in is not configured.");
  }
  return config;
}

function getOptionalAuthConfig(request: Request): AuthConfig | null {
  loadLocalEnv();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = process.env.AUTH_SECRET;

  if (!clientId || !clientSecret || !sessionSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    sessionSecret,
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ??
      new URL("/auth/google/callback", request.url).toString(),
    allowedDomain: process.env.GOOGLE_WORKSPACE_DOMAIN ?? process.env.ALLOWED_EMAIL_DOMAIN,
    adminEmails: parseCsv(process.env.ADMIN_EMAILS),
  };
}

export function isPortalAdmin(email: string) {
  loadLocalEnv();

  const adminEmails = parseCsv(process.env.ADMIN_EMAILS);
  return adminEmails.includes(email.toLowerCase());
}

function loadLocalEnv() {
  if (loadedLocalEnv) return;
  loadedLocalEnv = true;

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const env = readFileSync(envPath, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function toPublicSession(session: PortalSession) {
  return {
    email: session.email,
    name: session.name,
    picture: session.picture,
    hd: session.hd,
    isAdmin: isPortalAdmin(session.email),
  };
}

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(/;\s*/);
  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.split("=");
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: "Lax" | "Strict" | "None";
    secure?: boolean;
  } = {},
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}

function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ location });
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return new Response(null, { status: 302, headers });
}

function signValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function isSecureRequest(request: Request) {
  const url = new URL(request.url);
  return url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return character;
    }
  });
}
