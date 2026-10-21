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
5. **SQL Editor → New query**: paste all of `supabase/migrations/0002_quotes.sql` → **Run** (quotes + the "make invoice" function).
   Run this **before** deploying a version that has the Quotes tab; until then the tab shows a "not switched on yet" notice.
6. **SQL Editor → New query**: paste all of `supabase/migrations/0003_calls_expenses.sql` → **Run** (cold-call list, expenses, monthly target).
   Run 0002 and 0003 **before** deploying a version that uses them; until then those tabs show a "not switched on yet" notice.
7. **SQL Editor → New query**: paste all of `supabase/migrations/0004_lead_columns.sql` → **Run** (lead-sheet columns: allocated to, niche, tier, city, lead ID).
   Run it **before** pasting a lead sheet; plain pastes (name, phone) work without it.
8. **SQL Editor → New query**: paste all of `supabase/migrations/0005_payment_plans.sql` → **Run** (payment plans). Until it is run the "Payment plan" button is hidden.
9. **SQL Editor → New query**: paste all of `supabase/seed.sql` → **Run**.
   This links the two logins to *Michael* / *Trevor* (this is what grants access) and loads the starter data
   (Mohammed, R10 500 invoice, R15 000 deposit, "Intranet" deal, six tasks). Safe to re-run.
10. **Project Settings → API**: copy the **Project URL** and the **anon / public** key.
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
| Quote → invoice | Money → Quotes → "Make invoice": one invoice, or deposit % + final invoice, created atomically (`convert_quote`); a linked deal moves forward, never back |
| Revenue | money actually **received** (payments), by the month of the received date |
| Profit | money received − expenses, by month (expenses by the date spent) |
| Projected | open deals (not Paid) by the month each deal is due; overdue open deals count in the current month; the chart shows 6 months back and 5 ahead |
| Past income | Money → Revenue → "+ Past income": one row per amount, each booked to a month. Saved as an invoice plus a payment dated the 1st of that month (so Received and Profit pick it up), under the chosen client or a holding client called "Past income (before the CRM)" |
| Payment plan | Money → an invoice → "Payment plan": split what is still owed into dated payments (equal monthly to start, every date/amount editable, never more than is owed). Payments received tick them off in date order, ignoring anything paid before the plan was made; late ones show Overdue. Revenue table column "Plans due" totals unpaid instalments per month (overdue ones count in the current month) and is not added to Projected |
| Cold-call WhatsApp | Calls page: a "WhatsApp" button on every mobile number (06x/07x/08x) opens WhatsApp with the message ready, via a wa.me link, so on a phone it opens the WhatsApp app. Landlines show "Landline: no WhatsApp". "WhatsApp message" edits the text ({business} and {me} are filled in); it is saved on that device only |
| Target | one monthly revenue target (Money → Revenue), drawn as a dashed line |
| Lead sheet | Calls → Paste list accepts rows copied straight from a Google Sheet (Lead ID, Assigned To, Niche, Tier, Business Name, Category, Phone, City, Reviews, Unclaimed GBP, Also Listed As, Call Status). Tick callers under "Leave out the leads allocated to…" to skip theirs. Sheet statuses map to call results; Tier A shows first within each result group |
| Cold calls | Calls page: paste a list (duplicates by phone number are skipped), tick No answer / Call back later / Meeting booked / Interested / Not interested. "Interested" can create a client (source "Cold call") + a "Send quote" task + a call log entry in one step |

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

Database security checks are in `tests/db/` (`security.sql`: RLS + over-payment trigger; `quotes.sql`: quote conversion; `calls.sql`: lead → client, expenses, target).

## Adding or changing a user

Create the user in Supabase Auth, then run
`insert into public.profiles (id, name) select id, 'Michael' from auth.users where email = '…';`
The schema only allows the names Michael and Trevor.

`reference/nlws-crm-desktop.html` is the old single-file localStorage app, kept for reference only.
