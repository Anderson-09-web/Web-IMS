import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db, adminActionsTable, categoriesTable, discordVerificationsTable, favoritesTable, projectsTable, reportsTable, robloxLinksTable, usersTable, viewsTable, type Project, type User } from "@workspace/db";
import {
  CreateDiscordVerificationBody,
  CreateProjectBody,
  CreateRobloxLinkBody,
  DeleteProjectParams,
  GetAdminStatusResponse,
  GetDiscordVerificationStatusResponse,
  GetMeResponse,
  GetProjectParams,
  GetProjectResponse,
  GetStatsResponse,
  GetUserProfileParams,
  ListAdminProjectsQueryParams,
  ListCreatorsQueryParams,
  ListProjectsQueryParams,
  ModerateProjectBody,
  ModerateProjectParams,
  ReportProjectBody,
  ReportProjectParams,
  ToggleFavoriteParams,
  UpdateMeBody,
  UpdateProjectBody,
  UpdateProjectParams,
  VerifyDiscordFromBotBody,
  ConfirmRobloxLinkBody,
} from "@workspace/api-zod";
import { requireAuth, currentUserId } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type RequestWithUser = Request & { userId: string };

function userRequest(req: Request): RequestWithUser {
  return req as RequestWithUser;
}

function safeUsername(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `creator_${clean.slice(-12) || randomBytes(4).toString("hex")}`.slice(0, 24);
}

async function ensureUser(userId: string): Promise<User> {
  const existing = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (existing[0]) return existing[0];

  const username = safeUsername(userId);
  await db.insert(usersTable).values({
    id: userId,
    username,
    displayName: username,
    discordVerified: false,
    isAdmin: (process.env.ADMIN_USER_IDS ?? "").split(",").map((id) => id.trim()).includes(userId),
  }).onConflictDoNothing();
  const [created] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!created) throw new Error("Unable to provision profile");
  return created;
}

async function profileFor(user: User) {
  const [projectCount, kitCount, gameCount, resourceCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(and(eq(projectsTable.authorId, user.id), eq(projectsTable.status, "approved"))),
    db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(and(eq(projectsTable.authorId, user.id), eq(projectsTable.type, "kit"), eq(projectsTable.status, "approved"))),
    db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(and(eq(projectsTable.authorId, user.id), eq(projectsTable.type, "game"), eq(projectsTable.status, "approved"))),
    db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(and(eq(projectsTable.authorId, user.id), inArray(projectsTable.type, ["script", "map", "system", "resource", "other"]), eq(projectsTable.status, "approved"))),
  ]);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    discordName: user.discordName,
    discordVerified: user.discordVerified,
    robloxLinked: false,
    robloxUsername: null,
    bio: user.bio,
    websiteUrl: user.websiteUrl,
    tiktokUrl: user.tiktokUrl,
    projectCount: Number(projectCount[0]?.count ?? 0),
    kitCount: Number(kitCount[0]?.count ?? 0),
    gameCount: Number(gameCount[0]?.count ?? 0),
    resourceCount: Number(resourceCount[0]?.count ?? 0),
    joinedAt: user.createdAt,
  };
}

async function projectView(project: Project) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, project.authorId)).limit(1);
  if (!author) throw new Error("Project author not found");
  const profile = await profileFor(author);
  const [robloxLink] = await db.select({ username: robloxLinksTable.robloxUsername }).from(robloxLinksTable).where(and(eq(robloxLinksTable.userId, author.id), eq(robloxLinksTable.linked, true))).limit(1);
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    type: project.type,
    category: project.category,
    compatibility: project.compatibility,
    version: project.version,
    thumbnailUrl: project.thumbnailUrl,
    robloxUrl: project.robloxUrl,
    downloadUrl: project.downloadUrl,
    discordUrl: project.discordUrl,
    tiktokUrl: project.tiktokUrl,
    tags: project.tags ?? [],
    views: project.views,
    status: project.status,
    verified: project.verified,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    author: {
      ...profile,
      robloxLinked: Boolean(robloxLink),
      robloxUsername: robloxLink?.username ?? null,
    },
  };
}

function parseProjectId(req: Request, schema: typeof GetProjectParams | typeof DeleteProjectParams | typeof ToggleFavoriteParams | typeof ReportProjectParams | typeof UpdateProjectParams | typeof ModerateProjectParams): number | null {
  const parsed = schema.safeParse(req.params);
  return parsed.success ? parsed.data.id : null;
}

async function loadProject(id: number): Promise<Project | null> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  return project ?? null;
}

async function isAdmin(req: Request): Promise<boolean> {
  const userId = currentUserId(req);
  if (!userId) return false;
  const user = await ensureUser(userId);
  return user.isAdmin || (process.env.ADMIN_USER_IDS ?? "").split(",").map((id) => id.trim()).includes(userId);
}

function requireAdmin(req: Request, res: Response, next: () => void): void {
  isAdmin(req).then((allowed) => {
    if (!allowed) {
      res.status(currentUserId(req) ? 403 : 401).json({ error: currentUserId(req) ? "Administrator access required" : "Authentication required" });
      return;
    }
    next();
  }).catch(next);
}

function botKeyMatches(req: Request): boolean {
  const expected = process.env.DISCORD_API_KEY;
  const provided = req.header("x-api-key");
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

router.get("/stats", async (_req, res): Promise<void> => {
  const [projectCount, creatorCount, verifiedCount, totalViews] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(eq(projectsTable.status, "approved")),
    db.select({ count: sql<number>`count(distinct ${projectsTable.authorId})` }).from(projectsTable).where(eq(projectsTable.status, "approved")),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.discordVerified, true)),
    db.select({ total: sql<number>`coalesce(sum(${projectsTable.views}), 0)` }).from(projectsTable).where(eq(projectsTable.status, "approved")),
  ]);
  const featuredRows = await db.select().from(projectsTable).where(and(eq(projectsTable.status, "approved"), eq(projectsTable.verified, true))).orderBy(desc(projectsTable.views)).limit(4);
  const recentRows = await db.select().from(projectsTable).where(eq(projectsTable.status, "approved")).orderBy(desc(projectsTable.createdAt)).limit(6);
  const gameRows = await db.select().from(projectsTable).where(and(eq(projectsTable.status, "approved"), eq(projectsTable.type, "game"))).orderBy(desc(projectsTable.createdAt)).limit(4);
  const kitRows = await db.select().from(projectsTable).where(and(eq(projectsTable.status, "approved"), eq(projectsTable.type, "kit"))).orderBy(desc(projectsTable.createdAt)).limit(4);
  const data = {
    projectCount: Number(projectCount[0]?.count ?? 0),
    creatorCount: Number(creatorCount[0]?.count ?? 0),
    verifiedCount: Number(verifiedCount[0]?.count ?? 0),
    totalViews: Number(totalViews[0]?.total ?? 0),
    featured: await Promise.all(featuredRows.map(projectView)),
    recent: await Promise.all(recentRows.map(projectView)),
    games: await Promise.all(gameRows.map(projectView)),
    kits: await Promise.all(kitRows.map(projectView)),
  };
  res.json(GetStatsResponse.parse(data));
});

router.get("/projects", async (req, res): Promise<void> => {
  const parsed = ListProjectsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  const { search, category, compatibility, type, page = 1, pageSize = 12 } = parsed.data;
  const filters = [eq(projectsTable.status, "approved")];
  if (category) filters.push(eq(projectsTable.category, category));
  if (compatibility) filters.push(eq(projectsTable.compatibility, compatibility));
  if (type) filters.push(eq(projectsTable.type, type));
  if (search) {
    filters.push(or(ilike(projectsTable.name, `%${search}%`), ilike(projectsTable.description, `%${search}%`))!);
  }
  const [rows, countRows] = await Promise.all([
    db.select().from(projectsTable).where(and(...filters)).orderBy(desc(projectsTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(and(...filters)),
  ]);
  res.json({ items: await Promise.all(rows.map(projectView)), total: Number(countRows[0]?.count ?? 0), page, pageSize });
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const id = parseProjectId(req, GetProjectParams);
  if (!id) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const project = await loadProject(id);
  if (!project || project.status !== "approved") {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await db.insert(viewsTable).values({ projectId: id, viewerKey: req.ip ?? "anonymous" });
  await db.update(projectsTable).set({ views: sql`${projectsTable.views} + 1` }).where(eq(projectsTable.id, id));
  const fresh = await loadProject(id);
  res.json(GetProjectResponse.parse(await projectView(fresh ?? project)));
});

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const user = await ensureUser(userRequest(req).userId);
  if (user.isSuspended) {
    res.status(403).json({ error: "Account suspended" });
    return;
  }
  if (!user.discordVerified) {
    res.status(403).json({ error: "Discord verification is required to publish" });
    return;
  }
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db.insert(projectsTable).values({ ...parsed.data, authorId: user.id, status: "pending", verified: false }).returning();
  res.status(201).json(GetProjectResponse.parse(await projectView(created)));
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseProjectId(req, UpdateProjectParams);
  if (!id) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const project = await loadProject(id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const user = await ensureUser(userRequest(req).userId);
  if (project.authorId !== user.id && !user.isAdmin) {
    res.status(403).json({ error: "You cannot edit this project" });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(projectsTable).set({ ...parsed.data, status: "pending" }).where(eq(projectsTable.id, id)).returning();
  res.json(GetProjectResponse.parse(await projectView(updated)));
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseProjectId(req, DeleteProjectParams);
  if (!id) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const project = await loadProject(id);
  const user = await ensureUser(userRequest(req).userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (project.authorId !== user.id && !user.isAdmin) {
    res.status(403).json({ error: "You cannot delete this project" });
    return;
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.sendStatus(204);
});

router.post("/projects/:id/favorite", requireAuth, async (req, res): Promise<void> => {
  const id = parseProjectId(req, ToggleFavoriteParams);
  if (!id) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const userId = userRequest(req).userId;
  const [existing] = await db.select().from(favoritesTable).where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.projectId, id))).limit(1);
  let favorited = false;
  if (existing) await db.delete(favoritesTable).where(eq(favoritesTable.id, existing.id));
  else {
    await ensureUser(userId);
    await db.insert(favoritesTable).values({ userId, projectId: id });
    favorited = true;
  }
  const [count] = await db.select({ count: sql<number>`count(*)` }).from(favoritesTable).where(eq(favoritesTable.projectId, id));
  res.json({ favorited, favoriteCount: Number(count?.count ?? 0) });
});

router.post("/projects/:id/report", requireAuth, async (req, res): Promise<void> => {
  const id = parseProjectId(req, ReportProjectParams);
  if (!id) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const parsed = ReportProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  await ensureUser(userRequest(req).userId);
  const [report] = await db.insert(reportsTable).values({ projectId: id, reporterId: userRequest(req).userId, ...parsed.data }).returning();
  res.status(201).json(report);
});

router.get("/favorites", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select({ project: projectsTable }).from(favoritesTable).innerJoin(projectsTable, eq(favoritesTable.projectId, projectsTable.id)).where(and(eq(favoritesTable.userId, userRequest(req).userId), eq(projectsTable.status, "approved"))).orderBy(desc(favoritesTable.createdAt));
  res.json(await Promise.all(rows.map((row) => projectView(row.project))));
});

router.get("/creators", async (req, res): Promise<void> => {
  const parsed = ListCreatorsQueryParams.safeParse(req.query);
  const pageSize = parsed.success ? parsed.data.pageSize ?? 12 : 12;
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(pageSize);
  res.json(await Promise.all(users.map(profileFor)));
});

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = await ensureUser(userRequest(req).userId);
  const [link] = await db.select().from(robloxLinksTable).where(and(eq(robloxLinksTable.userId, user.id), eq(robloxLinksTable.linked, true))).limit(1);
  const profile = await profileFor(user);
  res.json(GetMeResponse.parse({ ...profile, robloxLinked: Boolean(link), robloxUsername: link?.robloxUsername ?? null }));
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  await ensureUser(userRequest(req).userId);
  const [updated] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, userRequest(req).userId)).returning();
  res.json(GetMeResponse.parse(await profileFor(updated)));
});

router.get("/users/:username", async (req, res): Promise<void> => {
  const parsed = GetUserProfileParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, parsed.data.username)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }
  res.json(await profileFor(user));
});

router.post("/verification/discord/code", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDiscordVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  const userId = userRequest(req).userId;
  await ensureUser(userId);
  await db.update(discordVerificationsTable).set({ usedAt: new Date() }).where(and(eq(discordVerificationsTable.userId, userId), isNull(discordVerificationsTable.usedAt)));
  const code = `IM-${randomBytes(4).toString("hex").slice(0, 5).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const [verification] = await db.insert(discordVerificationsTable).values({ userId, ...parsed.data, code, expiresAt }).returning();
  res.status(201).json({ code: verification.code, expiresAt: verification.expiresAt, discordName: verification.discordName, discordUserId: verification.discordUserId, used: false });
});

router.get("/verification/discord/status", requireAuth, async (req, res): Promise<void> => {
  const user = await ensureUser(userRequest(req).userId);
  const [latest] = await db.select().from(discordVerificationsTable).where(eq(discordVerificationsTable.userId, user.id)).orderBy(desc(discordVerificationsTable.createdAt)).limit(1);
  res.json(GetDiscordVerificationStatusResponse.parse({
    verified: user.discordVerified,
    discordName: user.discordName,
    discordUserId: user.discordUserId,
    botConnected: Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_API_KEY),
    lastBotCommunication: user.discordVerifiedAt ?? latest?.usedAt ?? null,
  }));
});

router.post("/discord/verify", async (req, res): Promise<void> => {
  if (!botKeyMatches(req)) {
    res.status(401).json({ error: "Invalid bot API key" });
    return;
  }
  const parsed = VerifyDiscordFromBotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  const [verification] = await db.select().from(discordVerificationsTable).where(and(eq(discordVerificationsTable.code, parsed.data.code), eq(discordVerificationsTable.discordUserId, parsed.data.discordUserId))).limit(1);
  if (!verification || verification.usedAt || verification.expiresAt < new Date()) {
    res.status(404).json({ verified: false, message: "Code invalid, expired, or already used", username: null });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, verification.userId)).limit(1);
  if (!user) {
    res.status(404).json({ verified: false, message: "Account not found", username: null });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(discordVerificationsTable).set({ usedAt: new Date() }).where(eq(discordVerificationsTable.id, verification.id));
    await tx.update(usersTable).set({ discordName: verification.discordName, discordUserId: verification.discordUserId, discordVerified: true, discordVerifiedAt: new Date() }).where(eq(usersTable.id, user.id));
  });
  logger.info({ userId: user.id }, "Discord account verified by bot");
  res.json({ verified: true, message: "Discord account verified", username: user.username });
});

router.post("/roblox/link", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateRobloxLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  const userId = userRequest(req).userId;
  await ensureUser(userId);
  await db.delete(robloxLinksTable).where(eq(robloxLinksTable.userId, userId));
  const challengeCode = `RBX-${randomInt(10000, 99999)}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const [link] = await db.insert(robloxLinksTable).values({ userId, challengeCode, robloxUsername: parsed.data.robloxUsername, expiresAt, linked: false }).returning();
  res.status(201).json({ challengeCode: link.challengeCode, robloxUserId: link.robloxUserId ?? "", robloxUsername: link.robloxUsername, displayName: link.displayName ?? "", avatarUrl: link.avatarUrl ?? "https://www.roblox.com/favicon.ico", linked: false, expiresAt: link.expiresAt });
});

router.post("/roblox/link/confirm", requireAuth, async (req, res): Promise<void> => {
  const parsed = ConfirmRobloxLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [link] = await db.select().from(robloxLinksTable).where(and(eq(robloxLinksTable.userId, userRequest(req).userId), eq(robloxLinksTable.challengeCode, parsed.data.challengeCode))).limit(1);
  if (!link || link.expiresAt < new Date()) {
    res.status(400).json({ error: "Roblox challenge expired or not found" });
    return;
  }
  const [updated] = await db.update(robloxLinksTable).set({ ...parsed.data, linked: true }).where(eq(robloxLinksTable.id, link.id)).returning();
  res.json(updated);
});

router.get("/admin/overview", requireAdmin, async (_req, res): Promise<void> => {
  const [pendingProjects, openReports, totalUsers, verifiedUsers] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(eq(projectsTable.status, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(inArray(reportsTable.status, ["open", "reviewing"])),
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.discordVerified, true)),
  ]);
  const status = { bot: process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_API_KEY ? "connected" : "unconfigured", api: "connected", database: "connected", lastBotCommunication: null };
  res.json({ pendingProjects: Number(pendingProjects[0]?.count ?? 0), openReports: Number(openReports[0]?.count ?? 0), totalUsers: Number(totalUsers[0]?.count ?? 0), verifiedUsers: Number(verifiedUsers[0]?.count ?? 0), systemStatus: status });
});

router.get("/admin/projects", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminProjectsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  const { status = "pending", page = 1, pageSize = 12 } = parsed.data;
  const [rows, countRows] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.status, status)).orderBy(desc(projectsTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(eq(projectsTable.status, status)),
  ]);
  res.json({ items: await Promise.all(rows.map(projectView)), total: Number(countRows[0]?.count ?? 0), page, pageSize });
});

router.post("/admin/projects/:id/moderate", requireAdmin, async (req, res): Promise<void> => {
  const id = parseProjectId(req, ModerateProjectParams);
  if (!id) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }
  const parsed = ModerateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(projectsTable).set({ status: parsed.data.status, verified: parsed.data.status === "approved" }).where(eq(projectsTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await db.insert(adminActionsTable).values({ adminId: userRequest(req).userId, projectId: id, action: parsed.data.status, note: parsed.data.note ?? null });
  res.json(GetProjectResponse.parse(await projectView(updated)));
});

router.get("/admin/reports", requireAdmin, async (_req, res): Promise<void> => {
  res.json(await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt)));
});

router.get("/admin/status", requireAdmin, async (_req, res): Promise<void> => {
  const status = {
    bot: process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_API_KEY ? "connected" : "unconfigured",
    api: "connected",
    database: "connected",
    lastBotCommunication: null,
  };
  res.json(GetAdminStatusResponse.parse(status));
});

router.get("/categories", async (_req, res): Promise<void> => {
  res.json(await db.select().from(categoriesTable).orderBy(categoriesTable.name));
});

export default router;