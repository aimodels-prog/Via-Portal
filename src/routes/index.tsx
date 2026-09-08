import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  FileText,
  LogOut,
  Monitor,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VIA Portal" },
      {
        name: "description",
        content: "A secure application portal for VIA International staff.",
      },
      { property: "og:title", content: "VIA Portal" },
      {
        property: "og:description",
        content: "Secure access to VIA applications.",
      },
    ],
  }),
  loader: () => loadPortalData(),
  component: Portal,
});

type PortalUser = {
  email: string;
  name?: string;
  isAdmin: boolean;
  jobTitle: string;
  department: string;
};

type PortalApp = {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: "file" | "sparkles" | "app";
  accent: "blue" | "green" | "red";
};

type PortalData = {
  user: PortalUser;
  apps: PortalApp[];
};

const loadPortalData = createServerFn({ method: "GET" }).handler(async () => {
  const [
    { getRequest },
    { getPortalSession, isPortalAdmin },
    { getStaffProfile, getVisibleApps, registerPortalUser },
  ] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("../lib/google-auth"),
    import("../lib/portal-store"),
  ]);
  const session = getPortalSession(getRequest());

  if (!session) return null;

  const isAdmin = isPortalAdmin(session.email);
  await registerPortalUser({
    email: session.email,
    name: session.name,
    picture: session.picture,
    isAdmin,
  });

  const [apps, staffProfile] = await Promise.all([
    getVisibleApps(session.email),
    getStaffProfile(session.email),
  ]);

  return {
    user: {
      email: session.email,
      name: session.name,
      isAdmin,
      jobTitle: staffProfile?.status === "active" ? staffProfile.jobTitle : "Staff",
      department: staffProfile?.status === "active" ? staffProfile.department : "",
    },
    apps,
  } satisfies PortalData;
});

const accentMap: Record<
  PortalApp["accent"],
  { bg: string; text: string; ring: string; line: string }
> = {
  blue: {
    bg: "bg-[var(--via-blue)]/7",
    text: "text-[var(--via-blue)]",
    ring: "ring-[var(--via-blue)]/15",
    line: "bg-[var(--via-blue)]",
  },
  green: {
    bg: "bg-[var(--via-green)]/8",
    text: "text-[var(--via-green)]",
    ring: "ring-[var(--via-green)]/15",
    line: "bg-[var(--via-green)]",
  },
  red: {
    bg: "bg-[var(--via-red)]/8",
    text: "text-[var(--via-red)]",
    ring: "ring-[var(--via-red)]/15",
    line: "bg-[var(--via-red)]",
  },
};

const iconMap = {
  file: FileText,
  sparkles: Sparkles,
  app: Monitor,
};

function Portal() {
  const initialState = Route.useLoaderData();
  const [state, setState] = useState<PortalData | undefined>(initialState ?? undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialState) return;

    fetch("/api/apps")
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace("/auth/signin");
          return null;
        }
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load portal apps.");
        }
        return payload;
      })
      .then((payload: PortalData | null) => {
        if (payload) setState(payload);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load portal.");
      });
  }, [initialState]);

  if (error) {
    return <PortalMessage title="Portal could not load" message={error} />;
  }

  if (!state) {
    return (
      <PortalMessage title="Opening workspace" message="Checking your secure session." loading />
    );
  }

  const { user, apps } = state;
  const firstName = getFirstName(user);
  const currentDate = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-foreground">
      <header className="sticky top-0 z-20 border-b border-[#dfe8f3] bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="/" className="flex items-center">
            <img src="/via-logo.png" alt="VIA International" className="h-12 w-auto" />
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            {user.isAdmin ? (
              <a
                href="/admin"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dfe8f3] bg-white px-3 text-sm font-semibold text-[#10223d] shadow-sm transition hover:border-[var(--via-blue)]/35"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </a>
            ) : null}
            <div className="hidden min-w-0 text-right md:block">
              <p className="truncate text-sm font-semibold text-[#10223d]">
                {user.name ?? user.email}
              </p>
              <p className="truncate text-xs text-[#69758b]">{user.email}</p>
            </div>
            <a
              href="/auth/signout"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#dfe8f3] bg-white text-[#69758b] shadow-sm transition hover:border-[var(--via-blue)]/35 hover:text-[#10223d]"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-8">
          <div className="overflow-hidden rounded-[10px] border border-[#dfe8f3] bg-white shadow-[0_24px_70px_rgba(13,43,79,0.08)]">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_260px] lg:items-end">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dfe8f3] bg-[#f7fafc] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--via-blue)]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--via-green)]" />
                  Verified workspace
                </div>
                <p className="text-sm font-semibold text-[#69758b]">{currentDate}</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-normal text-[#08172f] sm:text-5xl">
                  Good to see you, {firstName}.
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#647188]">
                  Your approved VIA systems are ready.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <Metric label="Apps" value={apps.length.toString()} />
                <Metric label="Access" value="Active" />
              </div>
            </div>
            <div className="grid h-1 grid-cols-3">
              <span className="bg-[var(--via-blue)]" />
              <span className="bg-[var(--via-green)]" />
              <span className="bg-[var(--via-red)]" />
            </div>
          </div>

          <section aria-label="Applications" className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-normal text-[#08172f]">
                  Applications
                </h2>
                <p className="mt-1 text-sm text-[#69758b]">
                  Open the tools assigned to your account.
                </p>
              </div>
              {user.isAdmin ? (
                <a
                  href="/admin"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--via-blue)] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(15,91,153,0.22)] transition hover:bg-[var(--via-blue-dark)]"
                >
                  <Plus className="h-4 w-4" />
                  Add app
                </a>
              ) : null}
            </div>

            {apps.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {apps.map((app) => (
                  <AppTile key={app.id} app={app} />
                ))}
              </div>
            ) : (
              <div className="rounded-[10px] border border-dashed border-[#cfdced] bg-white p-8 text-center">
                <Monitor className="mx-auto mb-3 h-8 w-8 text-[#8b97aa]" />
                <h3 className="text-base font-semibold text-[#08172f]">No apps assigned yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#69758b]">
                  A portal admin can assign software to your account.
                </p>
              </div>
            )}
          </section>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[10px] border border-[#dfe8f3] bg-white p-5 shadow-[0_18px_50px_rgba(13,43,79,0.06)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#69758b]">
              Session
            </h2>
            <div className="mt-5 space-y-4">
              <StatusLine label="Identity" value="Google" tone="blue" />
              <StatusLine label="Workspace" value="via-int.com" tone="green" />
              <StatusLine label="Role" value={user.jobTitle} tone="red" />
              {user.department ? (
                <StatusLine label="Department" value={user.department} tone="blue" />
              ) : null}
              {user.isAdmin ? (
                <StatusLine label="Portal access" value="Admin" tone="green" />
              ) : null}
            </div>
          </section>

          <section className="rounded-[10px] border border-[#dfe8f3] bg-[#08172f] p-5 text-white shadow-[0_18px_50px_rgba(8,23,47,0.18)]">
            <h2 className="text-lg font-semibold tracking-normal">VIA Portal</h2>
            <p className="mt-2 text-sm leading-6 text-white/68">
              Secure access, managed by your internal team.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}

function PortalMessage({
  title,
  message,
  loading,
}: {
  title: string;
  message: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f9fc] px-6">
      <div className="w-full max-w-md rounded-[10px] border border-[#dfe8f3] bg-white p-7 text-center shadow-[0_24px_70px_rgba(13,43,79,0.08)]">
        <img src="/via-logo.png" alt="VIA International" className="mx-auto mb-8 h-14 w-auto" />
        <Monitor
          className={`mx-auto mb-4 h-7 w-7 text-[var(--via-blue)] ${loading ? "animate-pulse" : ""}`}
        />
        <h1 className="text-xl font-semibold text-[#08172f]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#69758b]">{message}</p>
        {!loading ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center rounded-lg bg-[var(--via-blue)] px-4 text-sm font-semibold text-white"
            >
              Try again
            </button>
            <a
              href="/auth/signout"
              className="inline-flex h-10 items-center rounded-lg border border-[#dfe8f3] bg-white px-4 text-sm font-semibold text-[#10223d]"
            >
              Sign out
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AppTile({ app }: { app: PortalApp }) {
  const Icon = iconMap[app.icon] ?? Monitor;
  const style = accentMap[app.accent];

  return (
    <a
      href={`/sso/launch?app=${encodeURIComponent(app.id)}`}
      className="group relative min-h-[190px] overflow-hidden rounded-[10px] border border-[#dfe8f3] bg-white p-5 shadow-[0_18px_50px_rgba(13,43,79,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-[var(--via-blue)]/28 hover:shadow-[0_24px_70px_rgba(13,43,79,0.1)]"
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${style.line}`} />
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${style.bg} ${style.text} ring-1 ${style.ring}`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3ebf5] text-[#7a879a] transition group-hover:border-[var(--via-blue)]/30 group-hover:text-[var(--via-blue)]">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-7">
        <h3 className="text-lg font-semibold tracking-normal text-[#08172f]">{app.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#69758b]">
          {app.description || "Open application"}
        </p>
      </div>
    </a>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[#dfe8f3] bg-[#f7fafc] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#69758b]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-[#08172f]">{value}</p>
    </div>
  );
}

function StatusLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "red";
}) {
  const color =
    tone === "green"
      ? "bg-[var(--via-green)]"
      : tone === "red"
        ? "bg-[var(--via-red)]"
        : "bg-[var(--via-blue)]";

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-sm text-[#69758b]">{label}</span>
      </div>
      <span className="text-sm font-semibold text-[#10223d]">{value}</span>
    </div>
  );
}

function getFirstName(user: PortalUser) {
  const source = user.name || user.email;
  return source.split(/[ @]/)[0] || "there";
}
