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
(Vercel works too: same two variables.)

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
npm test                         # unit tests: money, dates, balance, chase, go-quiet, pipeline, filters
npm run typecheck && npm run build

# Browser tests
npx playwright test smoke        # no credentials needed: logged-out pages redirect to /login
E2E_EMAIL=you@example.com E2E_PASSWORD=... npx playwright test flows
                                 # logged-in flows: add client, add task, part payments, move deal
```

Run the `flows` tests against a **test** Supabase project. They create and then delete their own client,
but they do write real rows. If your machine already has Chromium, set `E2E_CHROMIUM=/path/to/chrome`.

Database security checks (RLS, over-payment trigger) are in `tests/db/security.sql`. They run against any
Postgres that has the migration applied plus a stub of Supabase's `auth` schema.

## Adding or changing a user

Create the user in Supabase Auth, then run
`insert into public.profiles (id, name) select id, 'Michael' from auth.users where email = '…';`
The schema only allows the names Michael and Trevor.

`reference/nlws-crm-desktop.html` is the old single-file localStorage app, kept for reference only.
