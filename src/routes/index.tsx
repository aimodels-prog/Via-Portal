import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  LayoutGrid,
  LogOut,
  Monitor,
  MessageSquareText,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
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
  logoUrl: string;
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

type AppPalette = {
  wash: string;
  solid: string;
  text: string;
  ring: string;
  line: string;
  border: string;
};

const accentMap: Record<PortalApp["accent"], AppPalette> = {
  blue: {
    wash: "bg-[#edf6fd]",
    solid: "bg-[var(--via-blue)]",
    text: "text-[var(--via-blue)]",
    ring: "ring-[var(--via-blue)]/20",
    line: "bg-[var(--via-blue)]",
    border: "border-[#cfe3f2]",
  },
  green: {
    wash: "bg-[#edf9f2]",
    solid: "bg-[var(--via-green)]",
    text: "text-[var(--via-green)]",
    ring: "ring-[var(--via-green)]/20",
    line: "bg-[var(--via-green)]",
    border: "border-[#ccebd8]",
  },
  red: {
    wash: "bg-[#fff0ef]",
    solid: "bg-[var(--via-red)]",
    text: "text-[var(--via-red)]",
    ring: "ring-[var(--via-red)]/20",
    line: "bg-[var(--via-red)]",
    border: "border-[#f3d1cf]",
  },
};

const blueAppPalettes = [
  accentMap.blue,
  {
    wash: "bg-[#eaf8fb]",
    solid: "bg-[#07829a]",
    text: "text-[#07829a]",
    ring: "ring-[#07829a]/20",
    line: "bg-[#07829a]",
    border: "border-[#c9e7ed]",
  },
  {
    wash: "bg-[#fff7e8]",
    solid: "bg-[#d8890d]",
    text: "text-[#b86b00]",
    ring: "ring-[#d8890d]/20",
    line: "bg-[#e39a19]",
    border: "border-[#f1dfbb]",
  },
  accentMap.red,
  accentMap.green,
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
  const visibleApps = apps.filter((app) =>
    `${app.name} ${app.description}`.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const sortingDisabled = Boolean(searchQuery.trim()) || savingOrder;

  async function handleDragEnd(event: DragEndEvent) {
    if (!state || sortingDisabled || !event.over || event.active.id === event.over.id) return;
    const oldIndex = state.apps.findIndex((app) => app.id === event.active.id);
    const newIndex = state.apps.findIndex((app) => app.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousApps = state.apps;
    const reorderedApps = arrayMove(previousApps, oldIndex, newIndex);
    setState({ ...state, apps: reorderedApps });
    setSavingOrder(true);
    setOrderMessage("");

    try {
      const response = await fetch("/api/apps/order", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appIds: reorderedApps.map((app) => app.id) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Unable to save application order.");
      setOrderMessage("Order saved");
      window.setTimeout(() => setOrderMessage(""), 1800);
    } catch (saveError) {
      setState((current) => (current ? { ...current, apps: previousApps } : current));
      setOrderMessage(saveError instanceof Error ? saveError.message : "Unable to save order.");
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-[#08172f] lg:grid lg:grid-cols-[244px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col justify-between overflow-hidden bg-[var(--via-blue)] px-5 py-7 text-white lg:flex">
        <div className="relative z-10">
          <a
            href="/"
            className="grid h-[70px] w-[178px] place-items-center rounded-lg border border-white/20 bg-white/5"
            aria-label="VIA Portal home"
          >
            <img
              src="/via-logo.png"
              alt="VIA International"
              className="w-[148px] brightness-0 invert"
            />
          </a>
        </div>

        <div className="pointer-events-none absolute -left-24 top-[45%] h-48 w-48 rounded-full border-[24px] border-white/15" />

        <div className="relative z-10 grid grid-cols-[40px_minmax(0,1fr)_32px] items-center gap-2 border-t border-white/20 pt-5">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-xs font-extrabold text-[var(--via-blue)]">
            {getInitials(user)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">{user.name ?? firstName}</p>
            <p className="mt-1 truncate text-[10px] text-white/65">{user.jobTitle}</p>
          </div>
          <a
            href="/auth/signout"
            className="grid h-8 w-8 place-items-center text-white/65 transition hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#dce5ed] bg-white/95 px-5 backdrop-blur lg:hidden">
          <div className="flex h-[70px] items-center justify-between">
            <a
              href="/"
              className="grid h-11 w-[132px] place-items-center rounded-lg bg-[var(--via-blue)]"
              aria-label="VIA Portal home"
            >
              <img
                src="/via-logo.png"
                alt="VIA International"
                className="w-[112px] brightness-0 invert"
              />
            </a>
            <div className="flex items-center gap-2">
              {user.isAdmin ? (
                <a
                  href="/admin"
                  className="grid h-10 w-10 place-items-center rounded-lg border border-[#d7e1ea] text-[#40566f]"
                  aria-label="Admin"
                  title="Admin"
                >
                  <Settings className="h-4 w-4" />
                </a>
              ) : null}
              <a
                href="/auth/signout"
                className="grid h-10 w-10 place-items-center rounded-lg border border-[#d7e1ea] text-[#65758a]"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </a>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-5 pb-10 sm:px-7 xl:px-9">
          <header className="flex min-h-[112px] flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <p className="text-xs text-[#718198]">{currentDate}</p>
              <p className="mt-2 text-sm font-semibold text-[#65758a]">Good to see you,</p>
              <p className="mt-0.5 text-3xl font-semibold leading-none text-[var(--via-blue)] sm:text-4xl">
                {firstName}.
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {user.isAdmin ? (
                <a
                  href="/admin"
                  className="hidden h-10 items-center gap-2 rounded-lg border border-[#d7e1ea] bg-white px-4 text-sm font-semibold text-[#40566f] transition hover:border-[var(--via-blue)]/45 sm:inline-flex"
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </a>
              ) : null}
              <label className="relative min-w-0 flex-1 sm:w-[210px] sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a98a9]" />
                <span className="sr-only">Search applications</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search apps"
                  className="h-10 w-full rounded-lg border border-[#d7e1ea] bg-[#eef3f7] pl-9 pr-3 text-sm text-[#40566f] outline-none transition placeholder:text-[#8a98a9] focus:border-[var(--via-blue)] focus:bg-white"
                />
              </label>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_278px]">
            <section className="relative min-h-[285px] overflow-hidden rounded-lg bg-[var(--via-blue)] p-7 text-white shadow-[0_22px_55px_rgba(14,76,127,0.18)] sm:p-9">
              <div className="relative z-10 flex min-h-[213px] max-w-2xl flex-col justify-center md:pr-48">
                <div className="inline-flex w-fit items-center gap-2 rounded-md border border-white/25 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#dceeff]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#64df96]" />
                  Verified VIA workspace
                </div>
                <h1 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-normal text-white sm:text-5xl">
                  Everything you need.
                  <br />
                  One secure place.
                </h1>
                <p className="mt-4 text-sm text-[#c4ddf1] sm:text-base">
                  Move between your daily systems without another password.
                </p>
              </div>

              <div
                className="absolute -right-12 -top-16 hidden h-[350px] w-[350px] rounded-full border border-white/25 md:block"
                aria-hidden="true"
              >
                <div className="absolute inset-[58px] rounded-full border-[30px] border-[#03345d]/30" />
                <div className="absolute inset-[132px] grid place-items-center rounded-full bg-white text-2xl font-extrabold text-[var(--via-blue)]">
                  {apps.length.toString().padStart(2, "0")}
                </div>
              </div>
              <div
                className="absolute bottom-5 right-5 hidden items-center gap-1.5 sm:flex"
                aria-hidden="true"
              >
                <span className="h-1.5 w-9 bg-white" />
                <span className="h-1.5 w-5 bg-[var(--via-green)]" />
                <span className="h-1.5 w-5 bg-[var(--via-red)]" />
              </div>
            </section>

            <aside
              id="access"
              className="rounded-lg border border-[#d8e3ec] bg-white p-6 shadow-[0_16px_40px_rgba(13,43,79,0.05)]"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#77889d]">
                Access status
              </p>
              <div className="mt-5 grid h-12 w-12 place-items-center rounded-full border border-[#bce8ce] bg-[#eaf9f0] text-xs font-extrabold text-[var(--via-green)]">
                OK
              </div>
              <h2 className="mt-5 text-xl font-semibold">You are connected</h2>
              <p className="mt-2 text-sm leading-6 text-[#718198]">
                Google Workspace identity verified for via-int.com.
              </p>
              <dl className="mt-5">
                <AccessRow label="Role" value={user.jobTitle} />
                <AccessRow label="Session" value="Active" />
                {user.department ? <AccessRow label="Department" value={user.department} /> : null}
              </dl>
            </aside>
          </div>

          <section id="applications" aria-label="Applications" className="mt-8 scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#77889d]">
                  Your tools
                </p>
                <h2 className="mt-1 text-3xl font-semibold tracking-normal">Applications</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#65758a]" aria-live="polite">
                  {savingOrder ? "Saving order..." : orderMessage}
                </span>
                <span className="text-xs text-[#77879a]">
                  {visibleApps.length} {visibleApps.length === 1 ? "app" : "apps"} available
                </span>
                {user.isAdmin ? (
                  <a
                    href="/admin"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--via-blue)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--via-blue-dark)]"
                  >
                    <Plus className="h-4 w-4" />
                    Add app
                  </a>
                ) : null}
              </div>
            </div>

            {visibleApps.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={visibleApps.map((app) => app.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid gap-3 xl:grid-cols-2">
                    {visibleApps.map((app) => (
                      <AppTile
                        key={app.id}
                        app={app}
                        onFeedback={setFeedbackApp}
                        sortingDisabled={sortingDisabled}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="rounded-lg border border-dashed border-[#cfdced] bg-white p-9 text-center">
                <LayoutGrid className="mx-auto mb-3 h-8 w-8 text-[#8b97aa]" />
                <h3 className="text-base font-semibold">
                  {apps.length > 0 ? "No matching applications" : "No apps assigned yet"}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#69758b]">
                  {apps.length > 0
                    ? "Try another search term."
                    : "A portal admin can assign software to your account."}
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--via-blue)] px-6">
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full border border-white/15"
        aria-hidden="true"
      >
        <div className="absolute inset-20 rounded-full border-[44px] border-[var(--via-blue)]/25" />
      </div>
      <div className="relative w-full max-w-md rounded-lg border border-[#dfe8f3] bg-white p-7 text-center shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
        <span className="mx-auto mb-8 grid h-[72px] w-[190px] place-items-center rounded-lg bg-[var(--via-blue)]">
          <img
            src="/via-logo.png"
            alt="VIA International"
            className="w-[158px] brightness-0 invert"
          />
        </span>
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

function AppTile({
  app,
  onFeedback,
  sortingDisabled,
}: {
  app: PortalApp;
  onFeedback: (app: PortalApp) => void;
  sortingDisabled: boolean;
}) {
  const Icon = iconMap[app.icon] ?? Monitor;
  const palette = getAppPalette(app);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app.id,
    disabled: sortingDisabled,
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={`group relative grid min-h-[124px] grid-cols-1 items-center overflow-hidden rounded-lg border bg-white p-4 transition duration-200 sm:grid-cols-[minmax(0,1fr)_82px] ${palette.border} ${
        isDragging
          ? "scale-[1.015] border-[var(--via-blue)]/45 opacity-95 shadow-[0_24px_60px_rgba(13,43,79,0.2)]"
          : "shadow-[0_10px_28px_rgba(13,43,79,0.04)] hover:-translate-y-0.5 hover:brightness-[0.995] hover:shadow-[0_20px_46px_rgba(13,43,79,0.11)]"
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[88px] ${palette.wash}`} aria-hidden="true" />
      <span className={`absolute inset-y-0 left-0 w-1.5 ${palette.line}`} aria-hidden="true" />
      <div
        {...attributes}
        {...listeners}
        className={`relative z-10 grid min-w-0 touch-none grid-cols-[56px_minmax(0,1fr)] items-center gap-4 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--via-blue)] ${
          sortingDisabled ? "cursor-default" : isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        aria-label={`Rearrange ${app.name}`}
        title={sortingDisabled ? undefined : `Drag to rearrange ${app.name}`}
      >
        <AppLogo app={app} Icon={Icon} palette={palette} />
        <div className="min-w-0">
          <p className={`text-[9px] font-extrabold uppercase tracking-[0.1em] ${palette.text}`}>
            {getAppCategory(app)}
          </p>
          <h3 className="mt-1 truncate text-lg font-semibold tracking-normal text-[#08172f]">
            {app.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-[#6f8094]">
            {app.description || "Open application"}
          </p>
        </div>
      </div>
      <div className="relative z-10 mt-3 flex items-center justify-end gap-2 border-t border-[#edf2f7] pt-3 sm:mt-0 sm:block sm:border-0 sm:pt-0 sm:text-right">
        <button
          type="button"
          onClick={() => onFeedback(app)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[10px] font-semibold text-[#7b899a] transition hover:bg-[#f0f5f9] hover:text-[var(--via-blue)] sm:mb-3"
          aria-label={`Share feedback about ${app.name}`}
          title={`Feedback for ${app.name}`}
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          Feedback
        </button>
        <a
          href={`/sso/launch?app=${encodeURIComponent(app.id)}`}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-extrabold ${palette.text} transition hover:bg-[#f0f5f9]`}
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" />
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
        className="w-full max-w-lg overflow-hidden rounded-lg border border-[#dfe8f3] bg-white shadow-[0_30px_90px_rgba(8,23,47,0.28)]"
      >
        <div className="flex items-start justify-between gap-4 bg-[var(--via-blue)] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#78b8e7]">
              {app.name}
            </p>
            <h2 id="feedback-title" className="mt-1 text-xl font-semibold text-white">
              Share feedback
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#36506a] text-[#9fb0c2] transition hover:border-white/45 hover:text-white"
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

function AppLogo({
  app,
  Icon,
  palette,
}: {
  app: PortalApp;
  Icon: LucideIcon;
  palette: AppPalette;
}) {
  const logoUrl = getAppLogoUrl(app);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [logoUrl]);

  return (
    <div className="relative grid h-12 w-12 place-items-center">
      {logoUrl && !imageFailed ? (
        <span
          className={`grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-white shadow-[0_5px_14px_rgba(13,43,79,0.09)] ring-2 ${palette.ring}`}
        >
          <img
            src={logoUrl}
            alt=""
            className="h-8 w-8 object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        </span>
      ) : (
        <span
          className={`grid h-12 w-12 place-items-center rounded-lg text-white shadow-[0_7px_16px_rgba(13,43,79,0.14)] ${palette.solid}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
      )}
    </div>
  );
}

function AccessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[#edf1f5] py-3 text-xs">
      <dt className="text-[#77879a]">{label}</dt>
      <dd className="m-0 truncate text-right font-extrabold text-[#08172f]">{value}</dd>
    </div>
  );
}

function getAppCategory(app: PortalApp) {
  if (app.icon === "sparkles") return "AI workspace";
  if (app.icon === "file") return "Projects";
  return "VIA application";
}

function getAppPalette(app: PortalApp) {
  if (app.accent !== "blue") return accentMap[app.accent];
  const hash = Array.from(app.id).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return blueAppPalettes[hash % blueAppPalettes.length];
}

function getAppLogoUrl(app: PortalApp) {
  if (app.logoUrl) return app.logoUrl;
  if (!app.url || app.url === "#") return "";
  try {
    return new URL("/favicon.ico", new URL(app.url).origin).toString();
  } catch {
    return "";
  }
}

function getInitials(user: PortalUser) {
  const source = user.name?.trim() || user.email.split("@")[0] || "VIA";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getFirstName(user: PortalUser) {
  const source = user.name || user.email;
  return source.split(/[ @]/)[0] || "there";
}
