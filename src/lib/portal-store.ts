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

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getPgConnectionString(databaseUrl),
    ssl: {
      rejectUnauthorized: false,
    },
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
    visibleToAllStaff: true,
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
    visibleToAllStaff: true,
    visibleToEmails: [],
  },
] satisfies Array<Omit<PortalApp, "createdAt" | "updatedAt">>;

export async function getVisibleApps(email: string) {
  await ensureSeedApps();
  const normalizedEmail = normalizeEmail(email);

  const apps = await prisma.application.findMany({
    where: {
      status: "active",
      OR: [
        { visibleToAllStaff: true },
        { visibleToEmails: { has: normalizedEmail } },
      ],
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
    visibleToAllStaff: input.visibleToAllStaff ?? true,
    visibleToEmails: normalizeEmails(input.visibleToEmails ?? []),
  };

  validateApp(app);
  return app;
}

function validateApp(app: {
  url: string;
  accent: string;
  icon: string;
  status: string;
}) {
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

function cleanRequired(value: string | undefined, label: string) {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(`${label} is required.`);
  return cleaned;
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
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
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
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
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
