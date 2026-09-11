import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type PortalApp = {
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
  createdAt: string;
  updatedAt: string;
};

export type AppInput = {
  name: string;
  url: string;
  description?: string;
  icon?: PortalApp["icon"];
  accent?: PortalApp["accent"];
  visibleToAllStaff?: boolean;
  visibleToEmails?: string[];
  status?: PortalApp["status"];
};

export type StaffProfile = {
  id: string;
  email: string;
  name: string;
  jobTitle: string;
  department: string;
  status: "active" | "inactive";
  visibleAppIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type StaffProfileInput = {
  email: string;
  name?: string;
  jobTitle: string;
  department?: string;
  status?: StaffProfile["status"];
  visibleAppIds?: string[];
};

export type PortalUserInput = {
  email: string;
  name?: string;
  picture?: string;
  isAdmin?: boolean;
};

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL?.trim().toLowerCase() !== "false";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getPgConnectionString(databaseUrl),
    ssl: databaseSsl ? { rejectUnauthorized: false } : false,
  }),
});

let schemaReady = false;

const seedApps = [
  {
    id: "tender-cv",
    name: "Tender CV",
    slug: "tender-cv",
    url: "#",
    description: "Manage tender submissions and CVs",
    status: "active",
    icon: "file",
    accent: "blue",
    visibleToAllStaff: false,
    visibleToEmails: [],
  },
  {
    id: "ai-vendor",
    name: "AI Vendor",
    slug: "ai-vendor",
    url: "#",
    description: "AI-powered vendor sourcing",
    status: "active",
    icon: "sparkles",
    accent: "green",
    visibleToAllStaff: false,
    visibleToEmails: [],
  },
] satisfies Array<Omit<PortalApp, "createdAt" | "updatedAt">>;

export async function getVisibleApps(email: string) {
  await ensureSeedApps();
  const normalizedEmail = normalizeEmail(email);
  const profile = await prisma.staffProfile.findUnique({
    where: { email: normalizedEmail },
  });

  if (!profile || profile.status !== "active") return [];

  const apps = await prisma.application.findMany({
    where: {
      status: "active",
      OR: [{ visibleToAllStaff: true }, { id: { in: profile.allowedAppIds } }],
    },
    orderBy: { name: "asc" },
  });

  return apps.map(toPortalApp);
}

export async function getAllApps() {
  await ensureSeedApps();
  const apps = await prisma.application.findMany({
    orderBy: { name: "asc" },
  });
  return apps.map(toPortalApp);
}

export async function createApp(input: AppInput) {
  await ensureSchema();

  const existingApps = await prisma.application.findMany({
    select: { slug: true },
  });
  const app = normalizeInput(input, createUniqueSlug(input.name, existingApps));
  const created = await prisma.application.create({
    data: {
      id: randomUUID(),
      ...app,
    },
  });
  return toPortalApp(created);
}

export async function updateApp(id: string, input: AppInput) {
  await ensureSchema();

  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing) return null;

  const app = normalizeInput(input, existing.slug);
  const updated = await prisma.application.update({
    where: { id },
    data: app,
  });
  return toPortalApp(updated);
}

export async function deleteApp(id: string) {
  await ensureSchema();

  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing) return false;

  await prisma.application.delete({ where: { id } });
  return true;
}

export async function getStaffProfile(email: string) {
  await ensureSchema();
  const profile = await prisma.staffProfile.findUnique({
    where: { email: normalizeEmail(email) },
  });
  return profile ? toStaffProfile(profile) : null;
}

export async function getAllStaffProfiles() {
  await ensureSchema();

  const users = await prisma.user.findMany({
    select: { email: true, name: true },
  });
  for (const user of users) {
    await prisma.staffProfile.upsert({
      where: { email: normalizeEmail(user.email) },
      update: {},
      create: {
        id: randomUUID(),
        email: normalizeEmail(user.email),
        name: user.name,
        jobTitle: "Staff",
        status: "active",
        allowedAppIds: [],
        accessConfigured: true,
      },
    });
  }

  const profiles = await prisma.staffProfile.findMany({
    orderBy: [{ jobTitle: "asc" }, { email: "asc" }],
  });
  return profiles.map((profile) => toStaffProfile(profile));
}

export async function registerPortalUser(input: PortalUserInput) {
  await ensureSchema();
  const email = normalizeEmail(input.email);
  const name = input.name?.trim() || null;

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      image: input.picture?.trim() || null,
      emailVerified: new Date(),
    },
    create: {
      id: randomUUID(),
      email,
      name,
      image: input.picture?.trim() || null,
      emailVerified: new Date(),
      role: input.isAdmin ? "admin" : "user",
    },
  });

  await prisma.staffProfile.upsert({
    where: { email },
    update: {},
    create: {
      id: randomUUID(),
      email,
      name,
      jobTitle: "Staff",
      status: "active",
      allowedAppIds: [],
      accessConfigured: true,
    },
  });
}

export async function createStaffProfile(input: StaffProfileInput) {
  await ensureSchema();
  const profile = normalizeStaffProfileInput(input);
  const created = await prisma.staffProfile.create({
    data: {
      id: randomUUID(),
      ...profile,
      allowedAppIds: normalizeIds(input.visibleAppIds ?? []),
      accessConfigured: true,
    },
  });
  return toStaffProfile(created);
}

export async function updateStaffProfile(id: string, input: StaffProfileInput) {
  await ensureSchema();
  const existing = await prisma.staffProfile.findUnique({ where: { id } });
  if (!existing) return null;

  const updated = await prisma.staffProfile.update({
    where: { id },
    data: {
      ...normalizeStaffProfileInput(input),
      allowedAppIds: normalizeIds(input.visibleAppIds ?? []),
      accessConfigured: true,
    },
  });
  return toStaffProfile(updated);
}

export async function deleteStaffProfile(id: string) {
  await ensureSchema();
  const existing = await prisma.staffProfile.findUnique({ where: { id } });
  if (!existing) return false;

  await prisma.staffProfile.delete({ where: { id } });
  return true;
}

async function ensureSeedApps() {
  await ensureSchema();

  const count = await prisma.application.count();
  if (count > 0) return;

  await prisma.application.createMany({
    data: seedApps,
    skipDuplicates: true,
  });
}

async function ensureSchema() {
  if (schemaReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Application" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "icon" TEXT NOT NULL DEFAULT 'app',
      "accent" TEXT NOT NULL DEFAULT 'blue',
      "visibleToAllStaff" BOOLEAN NOT NULL DEFAULT true,
      "visibleToEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Application_slug_key" ON "Application"("slug")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StaffProfile" (
      "id" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "name" TEXT,
      "jobTitle" TEXT NOT NULL DEFAULT 'Staff',
      "department" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_email_key" ON "StaffProfile"("email")
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "StaffProfile"
    ADD COLUMN IF NOT EXISTS "allowedAppIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "StaffProfile"
    ADD COLUMN IF NOT EXISTS "accessConfigured" BOOLEAN NOT NULL DEFAULT false
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Application"
    SET "visibleToAllStaff" = ("slug" = 'via-agent')
    WHERE EXISTS (
      SELECT 1
      FROM "StaffProfile"
      WHERE "accessConfigured" = false
    )
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "StaffProfile" AS staff
    SET
      "allowedAppIds" = ARRAY(
        SELECT app."id"
        FROM "Application" AS app
        WHERE app."status" = 'active'
          AND app."visibleToAllStaff" = false
          AND LOWER(staff."email") = ANY(
            SELECT LOWER(listed.email)
            FROM UNNEST(app."visibleToEmails") AS listed(email)
          )
      ),
      "accessConfigured" = true
    WHERE staff."accessConfigured" = false
  `);

  schemaReady = true;
}

function normalizeInput(input: AppInput, slug: string) {
  const app = {
    name: cleanRequired(input.name, "Application name"),
    slug,
    url: cleanRequired(input.url, "Application URL"),
    description: input.description?.trim() ?? "",
    status: input.status ?? "active",
    icon: input.icon ?? "app",
    accent: input.accent ?? "blue",
    visibleToAllStaff: input.visibleToAllStaff ?? false,
    visibleToEmails: normalizeEmails(input.visibleToEmails ?? []),
  };

  validateApp(app);
  return app;
}

function validateApp(app: { url: string; accent: string; icon: string; status: string }) {
  if (!["blue", "green", "red"].includes(app.accent)) {
    throw new Error("Invalid accent.");
  }

  if (!["file", "sparkles", "app"].includes(app.icon)) {
    throw new Error("Invalid icon.");
  }

  if (!["active", "inactive"].includes(app.status)) {
    throw new Error("Invalid status.");
  }

  if (app.url !== "#") {
    new URL(app.url);
  }
}

function normalizeStaffProfileInput(input: StaffProfileInput) {
  const email = normalizeEmail(cleanRequired(input.email, "Staff email"));
  const allowedDomain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim().toLowerCase();
  if (!email.includes("@") || (allowedDomain && !email.endsWith(`@${allowedDomain}`))) {
    throw new Error(
      allowedDomain
        ? `Staff email must belong to ${allowedDomain}.`
        : "A valid staff email is required.",
    );
  }

  const status = input.status ?? "active";
  if (!isStaffStatus(status)) throw new Error("Invalid staff status.");

  return {
    email,
    name: input.name?.trim() || null,
    jobTitle: cleanRequired(input.jobTitle, "Job title"),
    department: input.department?.trim() || null,
    status,
  };
}

function toPortalApp(app: {
  id: string;
  name: string;
  slug: string;
  url: string;
  description: string | null;
  status: string;
  icon: string;
  accent: string;
  visibleToAllStaff: boolean;
  visibleToEmails: string[];
  createdAt: Date;
  updatedAt: Date;
}): PortalApp {
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    url: app.url,
    description: app.description ?? "",
    status: app.status === "inactive" ? "inactive" : "active",
    icon: isIcon(app.icon) ? app.icon : "app",
    accent: isAccent(app.accent) ? app.accent : "blue",
    visibleToAllStaff: app.visibleToAllStaff,
    visibleToEmails: app.visibleToEmails,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

function toStaffProfile(profile: {
  id: string;
  email: string;
  name: string | null;
  jobTitle: string;
  department: string | null;
  status: string;
  allowedAppIds: string[];
  accessConfigured: boolean;
  createdAt: Date;
  updatedAt: Date;
}): StaffProfile {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name ?? "",
    jobTitle: profile.jobTitle,
    department: profile.department ?? "",
    status: isStaffStatus(profile.status) ? profile.status : "active",
    visibleAppIds: profile.allowedAppIds,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function cleanRequired(value: string | undefined, label: string) {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(`${label} is required.`);
  return cleaned;
}

function normalizeIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function createUniqueSlug(name: string, apps: Array<{ slug: string }>) {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let index = 2;

  while (apps.some((app) => app.slug === slug)) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }

  return slug;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app"
  );
}

function normalizeEmails(emails: string[]) {
  return [...new Set(emails.map(normalizeEmail).filter(Boolean))];
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isIcon(value: string): value is PortalApp["icon"] {
  return value === "file" || value === "sparkles" || value === "app";
}

function isAccent(value: string): value is PortalApp["accent"] {
  return value === "blue" || value === "green" || value === "red";
}

function isStaffStatus(value: string): value is StaffProfile["status"] {
  return value === "active" || value === "inactive";
}

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const env = readFileSync(envPath, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function getPgConnectionString(value: string) {
  const url = new URL(value);
  url.searchParams.delete("sslmode");
  return url.toString();
}
