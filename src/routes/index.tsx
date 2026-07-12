import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  FileText,
  LockKeyhole,
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
      { title: "VIA Portal - All Your Applications" },
      {
        name: "description",
        content:
          "The VIA Portal - a single Google Workspace sign-in for every VIA International application.",
      },
      { property: "og:title", content: "VIA Portal" },
      {
        property: "og:description",
        content: "One secure portal for every VIA application.",
      },
    ],
  }),
  component: Portal,
});

type PortalUser = {
  email: string;
  name?: string;
  isAdmin: boolean;
};

type PortalApp = {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: "file" | "sparkles" | "app";
  accent: "blue" | "green" | "red";
};

const accentMap: Record<
  PortalApp["accent"],
  { bg: string; text: string; ring: string; dot: string }
> = {
  blue: {
    bg: "bg-[var(--via-blue)]/8",
    text: "text-[var(--via-blue)]",
    ring: "ring-[var(--via-blue)]/20",
    dot: "bg-[var(--via-blue)]",
  },
  green: {
    bg: "bg-[var(--via-green)]/8",
    text: "text-[var(--via-green)]",
    ring: "ring-[var(--via-green)]/20",
    dot: "bg-[var(--via-green)]",
  },
  red: {
    bg: "bg-[var(--via-red)]/8",
    text: "text-[var(--via-red)]",
    ring: "ring-[var(--via-red)]/20",
    dot: "bg-[var(--via-red)]",
  },
};

const iconMap = {
  file: FileText,
  sparkles: Sparkles,
  app: Monitor,
};

const ssoSteps = [
  ["Google login", "Use your company account"],
  ["Portal access", "Show only approved apps"],
  ["App handoff", "No local passwords"],
];

function Portal() {
  const [state, setState] = useState<{
    user: PortalUser;
    apps: PortalApp[];
  }>();
  const [error, setError] = useState("");

  useEffect(() => {
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
      .then((payload: { user: PortalUser; apps: PortalApp[] } | null) => {
        if (payload) setState(payload);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load portal.");
      });
  }, []);

  if (error) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: "var(--gradient-subtle)" }}
      >
        <div className="max-w-md rounded-lg border border-border bg-background p-6 text-center">
          <Monitor className="mx-auto mb-4 h-8 w-8 text-[var(--via-blue)]" />
          <h1 className="text-xl font-semibold text-foreground">
            Portal could not load
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {error}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center rounded-lg bg-[var(--via-blue)] px-4 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
            <a
              href="/auth/signout"
              className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
            >
              Sign out
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: "var(--gradient-subtle)" }}
      >
        <div className="text-center">
          <ShieldCheck className="mx-auto mb-4 h-8 w-8 text-[var(--via-blue)]" />
          <h1 className="text-xl font-semibold text-foreground">
            Checking Google sign-in
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need to sign in before opening the VIA Portal.
          </p>
        </div>
      </div>
    );
  }

  const { user, apps } = state;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--gradient-subtle)" }}
    >
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <a href="/" className="text-2xl font-bold tracking-normal text-[var(--via-blue)]">
              VIA
            </a>
          </div>
          <div className="flex items-center gap-3">
            {user.isAdmin ? (
              <a
                href="/admin"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:border-[var(--via-blue)]/40"
              >
                <Settings className="h-4 w-4" />
                Admin
              </a>
            ) : null}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-foreground">
                {user.name ?? "Google Workspace"}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <a
              href="/auth/signout"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-[var(--via-blue)]/40 hover:text-foreground"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pt-16 pb-24">
        <section className="mb-12 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-[var(--via-green)]" />
            One account for every VIA application
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Welcome to the <span className="text-[var(--via-blue)]">VIA</span>{" "}
            Portal
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            You are signed in with Google Workspace. Open any approved
            application below without separate usernames or passwords.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#applications"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--via-blue)] px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-[var(--via-blue-dark)]"
            >
              <ArrowUpRight className="h-4 w-4" />
              Open applications
            </a>
            {user.isAdmin ? (
              <a
                href="/admin"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-5 text-sm font-semibold text-foreground transition hover:border-[var(--via-blue)]/40"
              >
                <Plus className="h-4 w-4" />
                Add application
              </a>
            ) : null}
          </div>
        </section>

        <section
          aria-label="Single sign-on status"
          className="mx-auto mb-10 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {ssoSteps.map(([title, detail]) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/75 px-4 py-3"
            >
              <LockKeyhole className="h-4 w-4 shrink-0 text-[var(--via-blue)]" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
        </section>

        <section
          id="applications"
          aria-label="Applications"
          className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {apps.length > 0 ? (
            apps.map((app) => <AppTile key={app.id} app={app} />)
          ) : (
            <div className="col-span-full rounded-lg border border-border bg-background/80 p-8 text-center">
              <Monitor className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                No applications assigned
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Ask a portal admin to add software for your account or make it
                visible to all staff.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t border-border/50 bg-background/60 py-8 backdrop-blur">
        <p className="text-center text-xs text-muted-foreground">
          (c) {new Date().getFullYear()} VIA International. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

function AppTile({ app }: { app: PortalApp }) {
  const Icon = iconMap[app.icon] ?? Monitor;
  const style = accentMap[app.accent];

  return (
    <a
      href={app.url}
      className="group relative flex flex-col rounded-lg border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--via-blue)]/30 hover:shadow-xl"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-5 flex items-start justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${style.bg} ${style.text} ring-1 ${style.ring} transition-all duration-300 group-hover:scale-105`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <ArrowUpRight className="h-5 w-5 text-muted-foreground/40 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--via-blue)]" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{app.name}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {app.description}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
        <span className="text-xs font-medium text-muted-foreground">
          Available
        </span>
      </div>
    </a>
  );
}
