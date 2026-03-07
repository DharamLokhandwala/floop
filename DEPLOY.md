# Deployment guide

Steps to deploy this Next.js app to production (e.g. Vercel) and set up the database.

---

## 1. Database (production)

The app uses **SQLite** locally (`DATABASE_URL`) and **Turso** in production. In production it reads **only** `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (see `lib/db.ts`). You do **not** need to set `DATABASE_URL` in Vercel.

Prisma’s schema uses `DATABASE_URL` for the **CLI** (e.g. `migrate deploy`). So to run migrations against Turso, you set `DATABASE_URL` to your Turso URL **only when running the migrate command** (see below).

### Option A: Turso (recommended for Vercel)

1. **Create a Turso account and database**
   - Go to [turso.tech](https://turso.tech) and sign up.
   - Create a new database (e.g. `website-analysis-prod`).
   - In the Turso dashboard, get:
     - **Database URL** (e.g. `libsql://your-db-name-your-org.turso.io`)
     - **Auth token** (create one if needed).

2. **Run Prisma migrations against Turso**
   - Prisma’s SQLite provider only accepts `file:` URLs, so use the project’s Turso migration script (reads `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from `.env`):
     ```bash
     node scripts/migrate-turso.mjs
     ```
   - The script creates `_prisma_migrations` if needed, baselines any migrations already reflected in the DB, then runs only pending migrations.
   - After that, your local `.env` can keep `DATABASE_URL` for SQLite; Vercel only needs `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

### Option B: Keep using SQLite in production

If you host on a platform with a persistent filesystem (e.g. a VPS), you can keep using SQLite:

- Set `DATABASE_URL` to a path like `file:./prod.sqlite` (or an absolute path).
- Run `npx prisma migrate deploy` once on the server (or in a build step that has access to that file).
- **Note:** Vercel and most serverless hosts do not have a persistent filesystem, so SQLite is not suitable there without Turso or another remote DB.

---

## 2. Environment variables (production)

Set these in your hosting dashboard (e.g. Vercel → Project → Settings → Environment Variables).

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Local dev only | SQLite path, e.g. `file:./dev.sqlite`. **Do not set in Vercel**; the app uses `TURSO_DATABASE_URL` in production. (Only set `DATABASE_URL` temporarily when running `prisma migrate deploy` against Turso.) |
| `TURSO_DATABASE_URL` | Yes (prod) | Turso database URL, e.g. `libsql://your-db.turso.io`. This is what the app uses in production. |
| `TURSO_AUTH_TOKEN` | Yes (prod) | Turso auth token. |
| `NEXTAUTH_URL` | Yes | Your app URL, e.g. `https://your-domain.com`. |
| `NEXTAUTH_SECRET` | Yes | Random secret for NextAuth (e.g. `openssl rand -base64 32`). |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob token (Dashboard → Storage → Create store → token). Used for screenshots. |
| `RESEND_API_KEY` | For email | Resend API key if you use magic-link login or notifications. |
| `RESEND_FROM` | Optional | From-address for Resend (defaults to Resend’s onboarding address). |

For **Vercel**, add these for **Production** (and optionally Preview if you want):

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NEXTAUTH_URL` = `https://your-vercel-domain.vercel.app` (or your custom domain)
- `NEXTAUTH_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `RESEND_API_KEY` (and `RESEND_FROM` if needed)

---

## 3. Deploy to Vercel

1. **Push your code** to GitHub (or GitLab/Bitbucket).
2. **Import the project** in [Vercel](https://vercel.com): New Project → Import repo.
3. **Configure build**
   - Build Command: `npm run build` (already runs `prisma generate` and `next build`).
   - Output: use default (Next.js).
   - Install Command: `npm install`.
4. **Add all environment variables** from the table above for Production.
5. **Deploy** (Vercel will run `npm run build` and then start the app).

No extra database or code changes are needed for deployment beyond:
- Running migrations once against the Turso DB (step 1),
- Setting the env vars (step 2).

---

## 4. After first deploy

- Open `NEXTAUTH_URL` in the browser and test sign-up / login.
- Create a test “Give feedback” or “Request feedback” link and confirm screenshot upload and sharing work (Blob + DB).

---

## Quick checklist

- [ ] Turso database created; URL and auth token copied.
- [ ] `npx prisma migrate deploy` run with Turso `DATABASE_URL` (+ auth) so production DB is up to date.
- [ ] All production env vars set in Vercel (or your host).
- [ ] Repo pushed; Vercel project connected and deployed.
- [ ] Smoke test: login, create audit, share link, view shared page.
