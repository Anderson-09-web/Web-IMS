import { and, eq, sql } from "drizzle-orm";
import { db, usersTable, projectsTable, gamesTable, kitsTable, resourcesTable, categoriesTable, tagsTable } from "@workspace/db";
import { logger } from "./logger";

const seedUserId = "system-inmortal";

export async function ensureSeedData(): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(projectsTable);
  if (Number(count) > 0) return;

  await db.insert(usersTable).values({
    id: seedUserId,
    username: "inmortal_studios",
    displayName: "Inmortal Studios",
    avatarUrl: null,
    discordName: "Inmortal Studios",
    discordUserId: null,
    discordVerified: true,
    bio: "La comunidad para crear, compartir y descubrir proyectos de Roblox.",
    tiktokUrl: "https://www.tiktok.com/@jose4535_",
    isAdmin: true,
  }).onConflictDoNothing();

  await db.insert(categoriesTable).values([
    { name: "Juegos", slug: "games" },
    { name: "Kits", slug: "kits" },
    { name: "Scripts", slug: "scripts" },
    { name: "Sistemas", slug: "systems" },
    { name: "Mapas", slug: "maps" },
    { name: "Recursos", slug: "resources" },
  ]).onConflictDoNothing();

  await db.insert(tagsTable).values([
    { name: "Studio Lite", slug: "studio-lite" },
    { name: "Roblox Studio", slug: "roblox-studio" },
    { name: "Principiante", slug: "beginner" },
    { name: "Multijugador", slug: "multiplayer" },
  ]).onConflictDoNothing();

  const [starterKit, obby, uiPack, terrain] = await db.insert(projectsTable).values([
    {
      authorId: seedUserId,
      name: "Starter Kit Studio Lite",
      description: "Una base ligera para comenzar a construir experiencias en Studio Lite con estructura limpia y ejemplos listos para editar.",
      type: "kit",
      category: "Kits",
      compatibility: "lite",
      version: "1.4.0",
      tags: ["Studio Lite", "Principiante"],
      views: 1842,
      status: "approved",
      verified: true,
    },
    {
      authorId: seedUserId,
      name: "Skyline Obby",
      description: "Juego de obstáculos vertical con checkpoints, tiempos y una ruta pensada para sesiones rápidas con amigos.",
      type: "game",
      category: "Juegos",
      compatibility: "both",
      version: "0.9.2",
      tags: ["Multijugador", "Roblox Studio"],
      views: 1260,
      status: "approved",
      verified: true,
      robloxUrl: "https://www.roblox.com/",
      tiktokUrl: "https://www.tiktok.com/@jose4535_",
    },
    {
      authorId: seedUserId,
      name: "UI Essentials",
      description: "Colección de componentes UI reutilizables para menús, inventarios y pantallas de configuración.",
      type: "resource",
      category: "Recursos",
      compatibility: "studio",
      version: "2.1.0",
      tags: ["Roblox Studio", "Principiante"],
      views: 932,
      status: "approved",
      verified: false,
    },
    {
      authorId: seedUserId,
      name: "Terrain Blocks",
      description: "Kit modular de terreno para prototipar mapas compactos y experimentar con diferentes recorridos.",
      type: "map",
      category: "Mapas",
      compatibility: "both",
      version: "1.0.1",
      tags: ["Studio Lite", "Roblox Studio"],
      views: 704,
      status: "approved",
      verified: false,
    },
  ]).returning();

  if (starterKit) await db.insert(kitsTable).values({ projectId: starterKit.id, kitKind: "starter" }).onConflictDoNothing();
  if (obby) await db.insert(gamesTable).values({ projectId: obby.id, genre: "Obby" }).onConflictDoNothing();
  if (uiPack) await db.insert(resourcesTable).values({ projectId: uiPack.id, resourceKind: "ui" }).onConflictDoNothing();
  if (terrain) await db.insert(resourcesTable).values({ projectId: terrain.id, resourceKind: "map" }).onConflictDoNothing();
  logger.info({ seededProjects: 4 }, "Community seed data ready");
}