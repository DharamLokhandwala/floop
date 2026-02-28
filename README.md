# UX/SEO/CRO Audit

A Next.js web application that performs automated UX, SEO, and CRO audits on websites. It captures full-page screenshots, analyzes them with Claude 3.5 Sonnet, and displays interactive feedback pins.

## Features

- **Capture Engine**: Uses Playwright to navigate to a URL, take a full-page screenshot, and store it in Vercel Blob
- **Analysis Engine**: Sends the screenshot and user goal to Claude 3.5 Sonnet for structured feedback (SEO, Visual Design, CRO)
- **Interactive UI**: Screenshot with SVG overlay and hoverable pins showing feedback
- **Persistence**: SQLite + Prisma for storing audit data
- **Sharing**: UUID-based URLs (`/audit/[id]`) for sharing results

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` - SQLite path for **local dev** (e.g. `file:./dev.db`). Not used when Turso is configured.
   - **Production (Turso):** set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` instead; the app uses Turso when both are set.
   - `NEXTAUTH_SECRET` - Secret for NextAuth (min 32 characters; use a long random string in production)
   - `NEXTAUTH_URL` - App URL (e.g. `http://localhost:3000` for dev, `https://your-app.vercel.app` for production)
   - `RESEND_API_KEY` - Resend API key for magic-link emails
   - `RESEND_FROM` - (optional) Verified sender email; omit to use Resend’s onboarding domain
   - `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude (optional if AI analysis is off)
   - `BLOB_READ_WRITE_TOKEN` - Vercel Blob token (required for screenshot uploads in production). Store name used for this app: **website-audit-blob**.
     
     To get your Vercel Blob token:
     1. Go to [Vercel Dashboard](https://vercel.com/dashboard/stores)
     2. Use the Blob store **website-audit-blob** (or create one and name it that)
     3. Copy the "Read and Write" token from the store settings
     4. Add it to your `.env` file as `BLOB_READ_WRITE_TOKEN="your-token-here"`
     
     Alternatively, if you're using Vercel CLI locally:
     ```bash
     vercel env pull
     ```

3. **Initialize database**

   ```bash
   npx prisma migrate dev
   ```

4. **Install Playwright browsers** (for screenshot capture)

   ```bash
   npx playwright install chromium
   ```

5. **Run development server**

   ```bash
   npm run dev
   ```

## Deploying with Turso (production)

For production (e.g. Vercel), use [Turso](https://turso.tech) instead of local SQLite:

1. Create a database in the Turso dashboard (or with `turso db create <name>`).
2. Get the database URL and create an auth token (`turso db tokens create <name>` or from the dashboard).
3. In Vercel (or your host), set:
   - `TURSO_DATABASE_URL` = your Turso URL (e.g. `libsql://your-db.turso.io`)
   - `TURSO_AUTH_TOKEN` = the token
4. **Apply migrations to Turso** (migrations are created against local SQLite; apply them to Turso manually). With the [Turso CLI](https://docs.turso.tech/cli/installation) installed and logged in (`turso auth login`), run each migration in order:

   ```bash
   turso db shell <your-db-name> < prisma/migrations/20260219194953_init/migration.sql
   turso db shell <your-db-name> < prisma/migrations/20260219204716_add_user_pins/migration.sql
   turso db shell <your-db-name> < prisma/migrations/20260228185329_add_archived/migration.sql
   turso db shell <your-db-name> < prisma/migrations/20260228194449_add_user/migration.sql
   turso db shell <your-db-name> < prisma/migrations/20260228202720_add_nextauth_models/migration.sql
   ```

   Replace `<your-db-name>` with your Turso database name. If a migration fails (e.g. table already exists), skip that one or fix the SQL for Turso.

5. Do **not** set `DATABASE_URL` in production when using Turso; the app uses the Turso adapter when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set.

## Mock Mode

Set `MOCK_ANALYSIS=true` in `.env` to bypass Claude and use sample pins for UI testing.

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS
- ShadcnUI
- Lucide React
- Prisma + SQLite
- Playwright
- Vercel Blob
- Anthropic Claude 3.5 Sonnet
