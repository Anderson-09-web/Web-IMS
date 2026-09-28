# Inmortal Studios

Plataforma web completa para desarrolladores de Roblox Studio y Roblox Studio Lite. Incluye cuentas, perfiles, proyectos, juegos, kits, recursos, favoritos, reportes, verificación de Discord, vinculación pública de Roblox y moderación administrativa.

## Arquitectura

- `artifacts/inmortal-studios`: frontend React + Vite. Se puede desplegar como sitio estático en Cloudflare Pages.
- `artifacts/api-server`: backend Express + API REST. Se puede desplegar como servicio Node en Render.
- `lib/api-spec/openapi.yaml`: contrato OpenAPI único. Genera los hooks React y validadores Zod.
- `lib/db`: PostgreSQL + Drizzle ORM.
- Clerk: autenticación de usuarios y sesiones.

La aplicación funciona en Replit con el API en `/api`. Cuando se separan servicios:

```text
Cloudflare Pages (frontend)  --->  VITE_API_URL  --->  Render (API + PostgreSQL)
                                      ^
                                      |
                           Discord bot /api/discord/verify
```

## Desarrollo local

Requisitos: Node.js 24, pnpm 10 y PostgreSQL.

```bash
pnpm install
cp .env.example .env
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
pnpm dev:backend
pnpm dev:frontend
```

La vista de Replit usa los workflows existentes. Para cambios en el contrato:

```bash
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
```

## Variables de entorno

Consulta `.env.example`. Las variables sensibles nunca deben ir en `VITE_*`, porque Vite las entrega al navegador.

### Frontend

- `VITE_API_URL`: URL pública del API en Render, por ejemplo `https://inmortal-studios-api.onrender.com`. En desarrollo Replit puede quedar vacío para usar `/api`.
- `VITE_CLERK_PUBLISHABLE_KEY`: clave pública de Clerk.
- `BASE_PATH`: `/` para Cloudflare Pages o para el dominio raíz.

### Backend

- `PORT`: Render la asigna automáticamente; el servidor usa `process.env.PORT`.
- `DATABASE_URL`: conexión PostgreSQL.
- `CLERK_SECRET_KEY` y `CLERK_PUBLISHABLE_KEY`: autenticación.
- `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`: configuración del bot.
- `DISCORD_API_KEY`: secreto compartido entre bot y API para `x-api-key`.
- `ADMIN_USER_IDS`: IDs de Clerk administradores separados por coma.
- `SESSION_SECRET`: reservado para sesiones auxiliares futuras.

## Base de datos

El esquema contiene:

`users`, `discord_verifications`, `roblox_links`, `projects`, `games`, `kits`, `resources`, `categories`, `tags`, `favorites`, `views`, `reports` y `admin_actions`.

En desarrollo:

```bash
pnpm --filter @workspace/db run push
```

En Render se debe provisionar PostgreSQL y conectar su `DATABASE_URL` al servicio. No se guardan contraseñas, cookies `.ROBLOSECURITY`, tokens privados ni secretos de Roblox.

## Discord

El bot oficial debe enviar:

```http
POST /api/discord/verify
x-api-key: DISCORD_API_KEY
content-type: application/json
```

```json
{
  "discordUserId": "123456789012345678",
  "code": "IM-7K4P9"
}
```

El backend comprueba usuario y código, valida expiración, lo consume una sola vez y marca el perfil como verificado. El ejemplo de integración está en `docs/discord-bot.md`.

## Roblox

La vinculación usa un código `RBX-48291` y datos públicos del usuario. El backend solo conserva User ID, username, display name y avatar público después de confirmar. No se solicita ni se guarda ninguna contraseña, cookie, token privado o credencial.

## Cloudflare Pages

Configura el proyecto de Pages apuntando al repositorio:

- Build command: `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-spec run codegen && pnpm --filter @workspace/inmortal-studios run build:cloudflare`
- Build output directory: `artifacts/inmortal-studios/dist/public`
- Node version: `24`
- Variable: `VITE_API_URL=https://<tu-api-en-render>`
- Variables de Clerk públicas: `VITE_CLERK_PUBLISHABLE_KEY`

`_redirects` mantiene las rutas de wouter funcionando al refrescar una página.

## Render

Importa el repositorio y usa `render.yaml`:

- Build: `pnpm install --frozen-lockfile && pnpm run build`
- Start: `pnpm --filter @workspace/api-server run start`
- Health check: `/api/healthz`

El API sirve el frontend compilado si existe `artifacts/inmortal-studios/dist/public`, lo que deja un fallback útil en un solo servicio. Para una separación estricta, Cloudflare Pages sirve el frontend y Render solo el API.

## GitHub

`.github/workflows/ci.yml` instala pnpm, regenera el contrato, ejecuta typecheck y valida el build de Cloudflare Pages en cada push y pull request.

## Seguridad

- Clerk protege rutas privadas y administración por rol.
- Rate limiting por IP en el API.
- Validación Zod generada desde OpenAPI.
- URLs y enums validados en la frontera.
- API key de bot mediante variable de entorno y comparación de tiempo constante.
- Códigos Discord/Roblox con expiración y consumo único.
- Logs estructurados sin tokens ni cookies.