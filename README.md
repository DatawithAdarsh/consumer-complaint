# Complaint Board

A 100% free-tier web app where people report complaints about companies (health insurers, e-commerce, grocery and food delivery, telecom) and see per-category rankings.

**Stack (all free tiers, no server to maintain)**

| Layer | Tool | Why |
|---|---|---|
| Database + API + Auth | Supabase (Postgres, auto REST API, email/Google login) | Free tier, security enforced in the DB with Row Level Security |
| Frontend | React + Vite | Static files, hosted free anywhere |
| Hosting | Cloudflare Pages (or Netlify / Vercel) | Free, global CDN, auto-deploy from GitHub |
| CI | GitHub Actions | Free for public repos |

There is no separate backend server. The "backend" is `supabase/schema.sql`: tables, security policies, the ranking view and anti-spam trigger.

## Project layout

```
supabase/schema.sql      tables, RLS policies, ranking view, seed data
supabase/tests.sql       manual backend tests (rolled back, safe to run)
src/lib/format.js        score helpers (unit tested)
src/components/          Rankings, ComplaintForm, CompanyPage, AuthBar
.github/workflows/       ci.yml (test+build), keepalive.yml (prevents Supabase pausing)
```

## 1. Set up the backend (10 min)

1. Create a free account at https://supabase.com and click **New project** (pick a region near your users, e.g. Mumbai). Save the database password.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, click **Run**.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public key**.
4. **Authentication → Providers**: Email is on by default. Optional: enable Google (needs a free Google Cloud OAuth client; the Supabase docs page for Google shows the exact redirect URL to paste).
5. **Authentication → URL Configuration**: set *Site URL* to your deployed URL (after step 3 below) and add `http://localhost:5173` to *Redirect URLs*.

**Important email limit:** Supabase's built-in email sender is heavily rate limited (only a few emails per hour), fine for testing but not for real users. Before launch, add a free SMTP provider under **Authentication → SMTP Settings** (for example Brevo's free plan, roughly 300 emails/day, or Resend's free plan). Google login has no such limit, so it's a good primary option.

## 2. Run locally

```bash
npm install
cp .env.example .env      # paste your Supabase URL and anon key
npm run dev               # http://localhost:5173
```

## 3. How to test

**Automated (frontend logic)**
```bash
npm test
```
Covers the scoring formula, bands, and ranking eligibility.

**Backend tests**: paste `supabase/tests.sql` into the SQL Editor and run. It checks seed counts, that the ranking view responds to complaints, that `user_id` is never exposed publicly, and that the 5-per-day limit trigger fires. Everything is rolled back at the end.

**Manual end-to-end checklist**
1. Open the app signed out: categories and rankings load; "Report a complaint" asks you to sign in.
2. Sign in via email link. Submit a complaint against Star Health. You land on the company page and see it.
3. Submit 2 more for the same company. In the Health Insurance tab it now shows a rank and score (needs 3+ complaints).
4. Submit a complaint with a new company name that isn't listed. It appears in the category.
5. Try submitting 6 complaints in a day. The 6th should show the daily limit error.
6. In a private window, confirm you cannot see any email or user id in the network responses (Dev Tools → Network → `public_complaints`).
7. Try pasting `<script>alert(1)</script>` in a description. It must display as plain text.
8. Resize to phone width and check the table scrolls and the form is usable.

**Security check (important):** in the Supabase **Table Editor** each table should show RLS enabled. In the SQL editor you can also run the Supabase **Advisors** (Database → Advisors) and fix any warnings. The two views run with owner rights on purpose so that raw `user_id`s stay hidden; this is expected and safe because they expose only aggregate and non-identifying columns.

## 4. Deploy (free)

1. Push this folder to a GitHub repo.
2. **Cloudflare Pages**: Workers & Pages → Create → Pages → Connect to Git → select the repo.
   - Framework preset: Vite (or Build command `npm run build`, Output directory `dist`)
   - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - Deploy. You get `https://your-app.pages.dev`; free custom domains are supported.
   - (Netlify and Vercel work the same way with the same build settings.)
3. Go back to Supabase **Authentication → URL Configuration** and set the Site URL to your Pages URL.
4. In GitHub: Settings → Secrets and variables → Actions → add `SUPABASE_URL` and `SUPABASE_ANON_KEY` so `keepalive.yml` can ping your project twice a week. Free Supabase projects pause after about a week of inactivity.
5. Every push to `main` now runs tests and auto-deploys.

## Moderation and legal (read this before launch)

- **Defamation risk is real.** Users are posting allegations about named companies. Keep the footer disclaimer, add a Terms/Privacy page, and have a clear takedown email. Consider adding a "Report this complaint" button. Consult a lawyer familiar with Indian law (IT Act / intermediary rules) before launching publicly.
- **Moderating:** in Supabase Table Editor → `complaints`, set `status` to `rejected` to hide a complaint immediately; it disappears from the rankings and public view.
- **Gaming:** rankings can be manipulated by fake or competitor complaints. Current defences: sign-in required, 5 complaints/day per user, smoothing so single complaints can't swing a score, minimum 3 complaints to rank. Next steps if abused: unique-per-company limits, email domain checks, a report button, CAPTCHA (Cloudflare Turnstile is free).
- **Scores ignore company size:** a big company gets more complaints simply for having more customers. The site says so; a future improvement is a "customers served" field per company to normalise.

## Free-tier limits to watch

Supabase free: about 500 MB database, 50,000 monthly active users, projects pause after inactivity. Cloudflare Pages free: unlimited bandwidth for static sites. Limits change, so verify on each provider's pricing page before launch.

## Ideas for later

Company-submitted public replies, upvotes ("me too"), photo/screenshot proof (Supabase Storage free tier), email verification of purchases, more categories (via the `categories` table, no code change needed).
