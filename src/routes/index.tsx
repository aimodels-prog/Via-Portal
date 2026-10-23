import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  LogOut,
  Monitor,
  MessageSquareText,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

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

type FeedbackCategory = "suggestion" | "recommendation" | "issue" | "other";

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
  const [feedbackApp, setFeedbackApp] = useState<PortalApp | null>(null);

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
                  <AppTile key={app.id} app={app} onFeedback={setFeedbackApp} />
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
      {feedbackApp ? (
        <FeedbackDialog app={feedbackApp} onClose={() => setFeedbackApp(null)} />
      ) : null}
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

function AppTile({ app, onFeedback }: { app: PortalApp; onFeedback: (app: PortalApp) => void }) {
  const Icon = iconMap[app.icon] ?? Monitor;
  const style = accentMap[app.accent];

  return (
    <article className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-[10px] border border-[#dfe8f3] bg-white p-5 shadow-[0_18px_50px_rgba(13,43,79,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-[var(--via-blue)]/28 hover:shadow-[0_24px_70px_rgba(13,43,79,0.1)]">
      <span className={`absolute inset-x-0 top-0 h-1 ${style.line}`} />
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${style.bg} ${style.text} ring-1 ${style.ring}`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <button
          type="button"
          onClick={() => onFeedback(app)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#dfe8f3] bg-white text-[#69758b] transition hover:border-[var(--via-blue)]/35 hover:text-[var(--via-blue)]"
          aria-label={`Share feedback about ${app.name}`}
          title={`Feedback for ${app.name}`}
        >
          <MessageSquareText className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-6 flex-1">
        <h3 className="text-lg font-semibold tracking-normal text-[#08172f]">{app.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#69758b]">
          {app.description || "Open application"}
        </p>
      </div>
      <div className="mt-5 border-t border-[#edf2f7] pt-4">
        <a
          href={`/sso/launch?app=${encodeURIComponent(app.id)}`}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--via-blue)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--via-blue-dark)]"
        >
          Open app
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

function FeedbackDialog({ app, onClose }: { app: PortalApp; onClose: () => void }) {
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId: app.id, category, message }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Unable to send feedback.");
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send feedback.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#08172f]/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="w-full max-w-lg overflow-hidden rounded-[10px] border border-[#dfe8f3] bg-white shadow-[0_30px_90px_rgba(8,23,47,0.28)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e8eef6] px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--via-blue)]">
              {app.name}
            </p>
            <h2 id="feedback-title" className="mt-1 text-xl font-semibold text-[#08172f]">
              Share feedback
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#dfe8f3] text-[#69758b] transition hover:text-[#08172f]"
            aria-label="Close feedback"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--via-green)]" />
            <h3 className="mt-4 text-lg font-semibold text-[#08172f]">Feedback sent</h3>
            <p className="mt-2 text-sm text-[#69758b]">
              The portal administrators can now review it.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--via-blue)] px-5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submitFeedback} className="space-y-5 px-6 py-5">
            <label className="block text-sm font-semibold text-[#10223d]">
              Feedback type
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                className="mt-2 h-11 w-full rounded-lg border border-[#d8e3ef] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--via-blue)]"
              >
                <option value="suggestion">Suggestion</option>
                <option value="recommendation">Recommendation</option>
                <option value="issue">Issue</option>
                <option value="other">Other note</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#10223d]">
              What should we improve?
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-2 min-h-36 w-full resize-y rounded-lg border border-[#d8e3ef] bg-white px-3 py-3 text-sm font-normal leading-6 outline-none focus:border-[var(--via-blue)]"
                placeholder="Write your suggestion, recommendation, or note..."
                maxLength={2000}
                required
              />
            </label>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#7a879a]">{message.length}/2000</span>
              <button
                type="submit"
                disabled={saving || !message.trim()}
                className="inline-flex h-10 items-center rounded-lg bg-[var(--via-blue)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--via-blue-dark)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {saving ? "Sending..." : "Send feedback"}
              </button>
            </div>
            {error ? (
              <p className="rounded-lg border border-[var(--via-red)]/25 bg-[var(--via-red)]/5 px-3 py-2 text-sm text-[var(--via-red)]">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </section>
    </div>
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
