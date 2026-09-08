import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  FileText,
  LoaderCircle,
  Monitor,
  Save,
  Sparkles,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "VIA Portal - Admin" },
      {
        name: "description",
        content: "Manage VIA Portal applications and staff access.",
      },
    ],
  }),
  component: AdminPage,
});

type PortalApp = {
  id: string;
  name: string;
  slug: string;
  url: string;
  description: string;
  status: "active" | "inactive";
  icon: "file" | "sparkles" | "app";
  accent: "blue" | "green" | "red";
  visibleToAllStaff: boolean;
  visibleToEmails: string[];
};

type FormState = {
  id?: string;
  name: string;
  url: string;
  description: string;
  status: PortalApp["status"];
  icon: PortalApp["icon"];
  accent: PortalApp["accent"];
  visibleToAllStaff: boolean;
  visibleToEmailsText: string;
};

type StaffProfile = {
  id: string;
  email: string;
  name: string;
  jobTitle: string;
  department: string;
  status: "active" | "inactive";
};

type StaffFormState = {
  id?: string;
  email: string;
  name: string;
  jobTitle: string;
  department: string;
  status: StaffProfile["status"];
};

const emptyForm: FormState = {
  name: "",
  url: "",
  description: "",
  status: "active",
  icon: "app",
  accent: "blue",
  visibleToAllStaff: true,
  visibleToEmailsText: "",
};

const emptyStaffForm: StaffFormState = {
  email: "",
  name: "",
  jobTitle: "",
  department: "",
  status: "active",
};

const iconMap = {
  file: FileText,
  sparkles: Sparkles,
  app: Monitor,
};

function AdminPage() {
  const [apps, setApps] = useState<PortalApp[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [staffForm, setStaffForm] = useState<StaffFormState>(emptyStaffForm);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState("");

  useEffect(() => {
    loadApps();
    loadStaff();
  }, []);

  function loadApps() {
    setLoading(true);
    fetch("/api/admin/apps")
      .then((response) => {
        if (response.status === 401) {
          window.location.replace("/auth/signin");
          return null;
        }
        if (response.status === 403) {
          window.location.replace("/");
          return null;
        }
        if (!response.ok) throw new Error("Unable to load applications.");
        return response.json();
      })
      .then((payload: { apps: PortalApp[] } | null) => {
        if (payload) setApps(payload.apps);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load.");
      })
      .finally(() => setLoading(false));
  }

  async function saveApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      url: form.url,
      description: form.description,
      status: form.status,
      icon: form.icon,
      accent: form.accent,
      visibleToAllStaff: form.visibleToAllStaff,
      visibleToEmails: parseEmails(form.visibleToEmailsText),
    };

    const response = await fetch(
      form.id ? `/api/admin/apps/${encodeURIComponent(form.id)}` : "/api/admin/apps",
      {
        method: form.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "Unable to save application.");
      setSaving(false);
      return;
    }

    setForm(emptyForm);
    setSaving(false);
    loadApps();
  }

  async function removeApp(app: PortalApp) {
    const confirmed = window.confirm(`Remove ${app.name} from the portal?`);
    if (!confirmed) return;

    await fetch(`/api/admin/apps/${encodeURIComponent(app.id)}`, {
      method: "DELETE",
    });
    loadApps();
  }

  function editApp(app: PortalApp) {
    setForm({
      id: app.id,
      name: app.name,
      url: app.url,
      description: app.description,
      status: app.status,
      icon: app.icon,
      accent: app.accent,
      visibleToAllStaff: app.visibleToAllStaff,
      visibleToEmailsText: app.visibleToEmails.join("\n"),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadStaff() {
    setStaffLoading(true);
    fetch("/api/admin/staff")
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (response.status === 401) {
          window.location.replace("/auth/signin");
          return null;
        }
        if (response.status === 403) {
          window.location.replace("/");
          return null;
        }
        if (!response.ok) throw new Error(payload?.error ?? "Unable to load staff.");
        return payload as { staff: StaffProfile[] };
      })
      .then((payload) => {
        if (payload) setStaff(payload.staff);
      })
      .catch((loadError) => {
        setStaffError(loadError instanceof Error ? loadError.message : "Unable to load staff.");
      })
      .finally(() => setStaffLoading(false));
  }

  async function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStaffSaving(true);
    setStaffError("");

    const response = await fetch(
      staffForm.id ? `/api/admin/staff/${encodeURIComponent(staffForm.id)}` : "/api/admin/staff",
      {
        method: staffForm.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(staffForm),
      },
    );
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setStaffError(result?.error ?? "Unable to save staff profile.");
      setStaffSaving(false);
      return;
    }

    setStaffForm(emptyStaffForm);
    setStaffSaving(false);
    loadStaff();
  }

  function editStaff(profile: StaffProfile) {
    setStaffForm({ ...profile });
    document.getElementById("staff-directory")?.scrollIntoView({ behavior: "smooth" });
  }

  async function removeStaff(profile: StaffProfile) {
    const confirmed = window.confirm(`Remove the staff profile for ${profile.email}?`);
    if (!confirmed) return;

    const response = await fetch(`/api/admin/staff/${encodeURIComponent(profile.id)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setStaffError(result?.error ?? "Unable to remove staff profile.");
      return;
    }
    loadStaff();
  }

  return (
    <div className="min-h-screen px-6 py-8" style={{ background: "var(--gradient-subtle)" }}>
      <main className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Portal
            </a>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Application Admin
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Add software to the portal and control which internal staff can see each application
              after Google sign-in.
            </p>
          </div>
        </header>

        <section className="mb-8 rounded-lg border border-border bg-background p-5">
          <form onSubmit={saveApp} className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground">Application name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                  placeholder="Finance Dashboard"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">Application URL</label>
                <input
                  value={form.url}
                  onChange={(event) => setForm({ ...form, url: event.target.value })}
                  className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                  placeholder="https://app.example.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="mt-2 min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[var(--via-blue)]"
                  placeholder="What this software is used for"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-sm font-semibold text-foreground">
                  Icon
                  <select
                    value={form.icon}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        icon: event.target.value as PortalApp["icon"],
                      })
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                  >
                    <option value="app">App</option>
                    <option value="file">File</option>
                    <option value="sparkles">AI</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-foreground">
                  Accent
                  <select
                    value={form.accent}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        accent: event.target.value as PortalApp["accent"],
                      })
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                  >
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="red">Red</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-foreground">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as PortalApp["status"],
                      })
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-border bg-muted/35 px-3 py-3 text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={form.visibleToAllStaff}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      visibleToAllStaff: event.target.checked,
                    })
                  }
                  className="h-4 w-4"
                />
                Visible to all staff
              </label>

              <div>
                <label className="text-sm font-semibold text-foreground">Staff emails</label>
                <textarea
                  value={form.visibleToEmailsText}
                  disabled={form.visibleToAllStaff}
                  onChange={(event) =>
                    setForm({ ...form, visibleToEmailsText: event.target.value })
                  }
                  className="mt-2 min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[var(--via-blue)] disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={"name@company.com\nanother@company.com"}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Turn off all-staff visibility to limit this software to listed emails.
                </p>
              </div>

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--via-blue)] px-4 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--via-blue-dark)] disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {form.id ? "Save changes" : "Add software"}
                </button>
                {form.id ? (
                  <button
                    type="button"
                    onClick={() => setForm(emptyForm)}
                    className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:border-[var(--via-blue)]/40"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </section>

        <section className="grid gap-4">
          {loading ? (
            <div className="rounded-lg border border-border bg-background p-6 text-sm text-muted-foreground">
              Loading applications...
            </div>
          ) : (
            apps.map((app) => (
              <article
                key={app.id}
                className="grid gap-4 rounded-lg border border-border bg-background p-5 md:grid-cols-[1fr_auto]"
              >
                <div className="flex gap-4">
                  <AppIcon app={app} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{app.name}</h2>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {app.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {app.description || "No description"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink className="h-3.5 w-3.5" />
                        {app.url}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UsersRound className="h-3.5 w-3.5" />
                        {app.visibleToAllStaff
                          ? "All staff"
                          : `${app.visibleToEmails.length} staff member${
                              app.visibleToEmails.length === 1 ? "" : "s"
                            }`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => editApp(app)}
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:border-[var(--via-blue)]/40"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeApp(app)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                    aria-label={`Remove ${app.name}`}
                    title={`Remove ${app.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))
          )}
        </section>

        <section id="staff-directory" className="mt-12 border-t border-border pt-10">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--via-green)]/10 text-[var(--via-green)]">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Staff directory</h2>
              <p className="text-sm text-muted-foreground">Manage staff titles and departments.</p>
            </div>
          </div>

          <form
            onSubmit={saveStaff}
            className="grid gap-4 border-y border-border bg-background py-5 lg:grid-cols-2"
          >
            <label className="text-sm font-semibold text-foreground">
              Staff email
              <input
                type="email"
                value={staffForm.email}
                onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })}
                className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                placeholder="name@via-int.com"
                required
              />
            </label>
            <label className="text-sm font-semibold text-foreground">
              Display name
              <input
                value={staffForm.name}
                onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })}
                className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                placeholder="Full name"
              />
            </label>
            <label className="text-sm font-semibold text-foreground">
              Job title
              <input
                value={staffForm.jobTitle}
                onChange={(event) => setStaffForm({ ...staffForm, jobTitle: event.target.value })}
                className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                placeholder="CEO"
                required
              />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
              <label className="text-sm font-semibold text-foreground">
                Department
                <input
                  value={staffForm.department}
                  onChange={(event) =>
                    setStaffForm({ ...staffForm, department: event.target.value })
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                  placeholder="Executive"
                />
              </label>
              <label className="text-sm font-semibold text-foreground">
                Status
                <select
                  value={staffForm.status}
                  onChange={(event) =>
                    setStaffForm({
                      ...staffForm,
                      status: event.target.value as StaffProfile["status"],
                    })
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[var(--via-blue)]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            {staffError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive lg:col-span-2">
                {staffError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 lg:col-span-2">
              <button
                type="submit"
                disabled={staffSaving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--via-blue)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--via-blue-dark)] disabled:opacity-60"
              >
                {staffSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : staffForm.id ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {staffForm.id ? "Save profile" : "Add staff profile"}
              </button>
              {staffForm.id ? (
                <button
                  type="button"
                  onClick={() => setStaffForm(emptyStaffForm)}
                  className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          <div className="mt-5 grid gap-3">
            {staffLoading ? (
              <div className="py-6 text-sm text-muted-foreground">Loading staff...</div>
            ) : staff.length === 0 ? (
              <div className="border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                No staff profiles yet.
              </div>
            ) : (
              staff.map((profile) => (
                <article
                  key={profile.id}
                  className="grid gap-4 border-b border-border bg-background py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {profile.name || profile.email}
                      </h3>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {profile.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{profile.email}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--via-blue)]">
                        <BriefcaseBusiness className="h-4 w-4" />
                        {profile.jobTitle}
                      </span>
                      {profile.department ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          {profile.department}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => editStaff(profile)}
                      className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStaff(profile)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                      aria-label={`Remove ${profile.email}`}
                      title={`Remove ${profile.email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function AppIcon({ app }: { app: PortalApp }) {
  const Icon = iconMap[app.icon] ?? Monitor;
  const color =
    app.accent === "green"
      ? "text-[var(--via-green)] bg-[var(--via-green)]/8"
      : app.accent === "red"
        ? "text-[var(--via-red)] bg-[var(--via-red)]/8"
        : "text-[var(--via-blue)] bg-[var(--via-blue)]/8";

  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${color}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function parseEmails(value: string) {
  return value
    .split(/[\n,]/)
    .map((email) => email.trim())
    .filter(Boolean);
}
