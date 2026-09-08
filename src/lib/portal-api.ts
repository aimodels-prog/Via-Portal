import { getPortalSession, isPortalAdmin } from "./google-auth";
import {
  createApp,
  createStaffProfile,
  deleteApp,
  deleteStaffProfile,
  getAllApps,
  getAllStaffProfiles,
  getStaffProfile,
  getVisibleApps,
  registerPortalUser,
  updateApp,
  updateStaffProfile,
  type AppInput,
  type StaffProfileInput,
} from "./portal-store";

export function isPortalApiRoute(pathname: string) {
  return (
    pathname === "/api/apps" ||
    pathname === "/api/admin/apps" ||
    pathname.startsWith("/api/admin/apps/") ||
    pathname === "/api/admin/staff" ||
    pathname.startsWith("/api/admin/staff/")
  );
}

export async function handlePortalApi(request: Request) {
  const session = getPortalSession(request);
  if (!session) {
    return json({ error: "Authentication required." }, 401);
  }

  const url = new URL(request.url);

  if (url.pathname === "/api/apps" && request.method === "GET") {
    try {
      await registerPortalUser({
        email: session.email,
        name: session.name,
        picture: session.picture,
        isAdmin: isPortalAdmin(session.email),
      });
      const [apps, staffProfile] = await Promise.all([
        getVisibleApps(session.email),
        getStaffProfile(session.email),
      ]);
      return json({
        apps,
        user: {
          email: session.email,
          name: session.name,
          picture: session.picture,
          isAdmin: isPortalAdmin(session.email),
          jobTitle: staffProfile?.status === "active" ? staffProfile.jobTitle : "Staff",
          department: staffProfile?.status === "active" ? staffProfile.department : "",
        },
      });
    } catch (error) {
      console.error(error);
      return json({ error: getErrorMessage(error) }, 500);
    }
  }

  if (!isPortalAdmin(session.email)) {
    return json({ error: "Admin access required." }, 403);
  }

  if (url.pathname === "/api/admin/apps" && request.method === "GET") {
    try {
      return json({ apps: await getAllApps() });
    } catch (error) {
      console.error(error);
      return json({ error: getErrorMessage(error) }, 500);
    }
  }

  if (url.pathname === "/api/admin/apps" && request.method === "POST") {
    try {
      return json({ app: await createApp(await readAppInput(request)) }, 201);
    } catch (error) {
      return json({ error: getErrorMessage(error) }, 400);
    }
  }

  if (url.pathname === "/api/admin/staff" && request.method === "GET") {
    try {
      return json({ staff: await getAllStaffProfiles() });
    } catch (error) {
      console.error(error);
      return json({ error: getErrorMessage(error) }, 500);
    }
  }

  if (url.pathname === "/api/admin/staff" && request.method === "POST") {
    try {
      return json({ profile: await createStaffProfile(await readStaffProfileInput(request)) }, 201);
    } catch (error) {
      return json({ error: getErrorMessage(error) }, 400);
    }
  }

  if (url.pathname.startsWith("/api/admin/staff/")) {
    const profileId = url.pathname.replace("/api/admin/staff/", "");

    if (profileId && request.method === "PUT") {
      try {
        const profile = await updateStaffProfile(profileId, await readStaffProfileInput(request));
        if (!profile) return json({ error: "Staff profile not found." }, 404);
        return json({ profile });
      } catch (error) {
        return json({ error: getErrorMessage(error) }, 400);
      }
    }

    if (profileId && request.method === "DELETE") {
      return (await deleteStaffProfile(profileId))
        ? json({ ok: true })
        : json({ error: "Staff profile not found." }, 404);
    }
  }

  const appId = url.pathname.startsWith("/api/admin/apps/")
    ? url.pathname.replace("/api/admin/apps/", "")
    : "";

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
    return (await deleteApp(appId))
      ? json({ ok: true })
      : json({ error: "Application not found." }, 404);
  }

  return json({ error: "Not found." }, 404);
}

async function readStaffProfileInput(request: Request): Promise<StaffProfileInput> {
  const body = (await request.json()) as StaffProfileInput;
  return {
    email: body.email,
    name: body.name,
    jobTitle: body.jobTitle,
    department: body.department,
    status: body.status,
    visibleAppIds: body.visibleAppIds,
  };
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
