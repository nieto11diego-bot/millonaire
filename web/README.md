# Millionaire City — web (Next.js + Supabase)

Cloud auth and saves for the canvas game. Deploy this folder on Vercel.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`../supabase/migrations/001_saves.sql`](../supabase/migrations/001_saves.sql).
3. Auth → Providers: enable Email.
4. Auth → URL configuration:
   - Site URL: `http://localhost:3000` (dev) or your Vercel URL
   - Redirect URLs: `http://localhost:3000/auth/callback` and `https://<project>.vercel.app/auth/callback`
5. Copy `.env.example` → `.env.local` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

6. Install and run (requires Node 18+):

```bash
cd web
npm install
npm run dev
```

- Menu: http://localhost:3000  
- Game: http://localhost:3000/play (or `/game/index.html`)

## Vercel

1. Import the Git repo in Vercel.
2. Set **Root Directory** to `web`.
3. Add the same env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy.
5. Update Supabase Auth redirect URLs to the production domain.

## Syncing the game copy

The playable build under `public/game/` is a copy of `../millionaire-city/`. After editing the game, refresh it:

```powershell
robocopy ..\millionaire-city public\game /E /XD tools
```

## How saves work

| Mode | Storage |
|------|---------|
| Guest | `localStorage` only |
| Logged in | `localStorage` + row in `public.saves` (one per user) |

On load, the newer of local vs cloud wins (`savedAt`). If cloud is empty and local exists, the local snapshot is uploaded.

Game API (cookie session):

- `GET /api/saves` — current user + snapshot
- `PUT /api/saves` — upsert snapshot
- `DELETE /api/saves` — wipe cloud save (used by “Nueva partida”)
