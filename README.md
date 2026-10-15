# Next Level Web Solutions CRM

Two-user CRM (Michael + Trevor). Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth) · Netlify.

- Login required on every page; no public sign-up.
- Row Level Security on every table: only accounts listed in `profiles` (Michael, Trevor) can read or write.
- Amounts in rand (`R 10 500`), dates `DD/MM/YYYY`, "today" = South African time, light/dark mode, mobile-friendly.

## 1. Supabase setup (once)

1. [supabase.com](https://supabase.com) → **New project**. Save the database password somewhere safe.
2. **Authentication → Providers → Email**: turn **OFF** "Allow new users to sign up" (leave the email provider on). Save.
3. **Authentication → Users → Add user → Create new user**, ticking **Auto Confirm User**:
   - `michaelvaneck11@gmail.com` + a strong password
   - `ryantrevor72@gmail.com` + a strong password
4. **SQL Editor → New query**: paste all of `supabase/migrations/0001_init.sql` → **Run**.
5. **SQL Editor → New query**: paste all of `supabase/seed.sql` → **Run**.
   This links the two logins to *Michael* / *Trevor* (this is what grants access) and loads the starter data
   (Mohammed, R10 500 invoice, R15 000 deposit, "Intranet" deal, six tasks). Safe to re-run.
6. **Project Settings → API**: copy the **Project URL** and the **anon / public** key.
   Do **not** use the `service_role` key anywhere in this app.

## 2. Run locally

```bash
cp .env.example .env.local      # paste the URL + anon key
npm install
npm run dev                     # http://localhost:3000
```

## 3. Deploy to Netlify

1. [netlify.com](https://netlify.com) → **Add new site → Import an existing project → GitHub** → pick `nalabuddy/my-crm`, branch `main`.
2. Leave the build settings as detected (Next.js; `netlify.toml` sets Node 22).
3. Before deploying, open **Site configuration → Environment variables** (or "Add environment variables" on the setup page) and add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Deploy**.
4. In Supabase: **Authentication → URL Configuration** → set **Site URL** to your Netlify address (`https://….netlify.app`).

The anon/publishable key is visible in the browser by design. Login plus RLS is the protection, not key secrecy.
(Vercel works too: same two variables. `vercel.json` pins functions to Dublin, next to a Supabase project in Ireland; change `dub1` if your Supabase region differs.)

## Rules the app uses

| Item | Rule |
|---|---|
| Balance | invoice `amount` − sum of its `payments` (computed in the `invoice_balances` view) |
| Owed on invoices | balances where kind = Invoice |
| Deposits pending | balances where kind = Deposit |
| Open pipeline | deal values at every stage except Paid |
| Money to chase | balance > 0 **and** (promised date passed **or** no promised date) |
| Go quiet | Lead/Active clients whose last logged contact is 14+ days ago (or created 14+ days ago with none) |
| Mine | the logged-in user; tasks assigned to "Both" show for each person |
| Over-payment | rejected by a database trigger, not just the form |

## Tests

```bash
npm test                         # unit tests: money, dates, balance, chase, go-quiet, pipeline, filters, WhatsApp links
npm run typecheck && npm run build
npx playwright test smoke        # no database needed: logged-out pages redirect to /login, install files are public
```

**Logged-in browser tests** (add client, add task, part payments incl. over-payment, edit/delete a payment,
Chase link, move deal, Overview numbers, "no profile" account turned away) need a Supabase to talk to. Either:

- point them at a **test** Supabase project: `E2E_EMAIL=… E2E_PASSWORD=… npx playwright test` (they write
  and delete their own rows), or
- run the **local stack** in `tests/local-stack/` (real Postgres + your migration/seed/RLS + PostgREST + a tiny
  login stand-in; no accounts or internet needed):
  `PGRST_BIN=/path/to/postgrest bash tests/local-stack/start.sh`, then run Playwright with
  `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local
  E2E_EMAIL=michaelvaneck11@gmail.com E2E_PASSWORD=test-pass-michael
  E2E_STRANGER_EMAIL=stranger@example.com E2E_STRANGER_PASSWORD=test-pass-stranger`.

If your machine already has Chromium, set `E2E_CHROMIUM=/path/to/chrome`.

Database security checks (RLS, over-payment trigger) are in `tests/db/security.sql`.

## Adding or changing a user

Create the user in Supabase Auth, then run
`insert into public.profiles (id, name) select id, 'Michael' from auth.users where email = '…';`
The schema only allows the names Michael and Trevor.

`reference/nlws-crm-desktop.html` is the old single-file localStorage app, kept for reference only.
