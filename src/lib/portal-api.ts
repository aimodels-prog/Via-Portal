import { getPortalSession, isPortalAdmin } from "./google-auth";
import {
  createApp,
  deleteApp,
  getAllApps,
  getVisibleApps,
  updateApp,
  type AppInput,
} from "./portal-store";

export function isPortalApiRoute(pathname: string) {
  return pathname === "/api/apps" ||
    pathname === "/api/admin/apps" ||
    pathname.startsWith("/api/admin/apps/");
}

export async function handlePortalApi(request: Request) {
  const session = getPortalSession(request);
  if (!session) {
    return json({ error: "Authentication required." }, 401);
  }

  const url = new URL(request.url);

  if (url.pathname === "/api/apps" && request.method === "GET") {
    return json({
      apps: await getVisibleApps(session.email),
      user: {
        email: session.email,
        name: session.name,
        picture: session.picture,
        isAdmin: isPortalAdmin(session.email),
      },
    });
  }

  if (!isPortalAdmin(session.email)) {
    return json({ error: "Admin access required." }, 403);
  }

  if (url.pathname === "/api/admin/apps" && request.method === "GET") {
    return json({ apps: await getAllApps() });
  }

  if (url.pathname === "/api/admin/apps" && request.method === "POST") {
    try {
      return json({ app: await createApp(await readAppInput(request)) }, 201);
    } catch (error) {
      return json({ error: getErrorMessage(error) }, 400);
    }
  }

  const appId = url.pathname.replace("/api/admin/apps/", "");

  if (appId && request.method === "PUT") {
    try {
      const app = await updateApp(appId, await readAppInput(request));
      if (!app) return json({ error: "Application not found." }, 404);
      return json({ app });
    } catch (error) {
      return json({ error: getErrorMessage(error) }, 400);
    }
  }

  if (appId && request.method === "DELETE") {
    return await deleteApp(appId)
      ? json({ ok: true })
      : json({ error: "Application not found." }, 404);
  }

  return json({ error: "Not found." }, 404);
}

async function readAppInput(request: Request): Promise<AppInput> {
  const body = (await request.json()) as AppInput;
  return {
    name: body.name,
    url: body.url,
    description: body.description,
    icon: body.icon,
    accent: body.accent,
    status: body.status,
    visibleToAllStaff: body.visibleToAllStaff,
    visibleToEmails: body.visibleToEmails,
  };
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
