# Standing up a fresh Supabase project

*Written for the day the old project became unreachable. It is also the fastest
way to get a clean one — the old project was shared with the design lane, whose
seed used to write into the demo record (PROGRESS §4.2).*

Nothing is lost by starting over: **the record is rebuilt from the fixtures in
this repo, by machine, with no AI spend.** The 27 documents, their images and
PDFs, and all 123 facts live in `demo-data/` and are seeded straight into the
tables. The doses come out right first time — the hand-corrections noted in
PROGRESS §5 were only needed because those rows were ingested by an older
extractor.

Budget about ten minutes. Four of the six steps are a script.

---

## 1. Create the project

[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.

| Field | Use |
|---|---|
| Name | `aftercare` |
| Region | **London (eu-west-2)** — the app is Europe/London throughout |
| Database password | Generate one and keep it; it goes in step 2 |
| Plan | Free is enough for a week-long demo |

It takes a couple of minutes to provision.

## 2. Put four values in `.env.local`

**Project Settings → API Keys**

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon / publishable key>
SUPABASE_SERVICE_ROLE_KEY=<the service_role / secret key>
```

**Connect** (top bar) → **Session pooler** → copy the URI:

```
SUPABASE_DB_URL=postgresql://postgres.<ref>:<PASSWORD>@aws-0-eu-west-2.pooler.supabase.com:5432/postgres
```

Use the **session** pooler on port 5432. The transaction pooler (6543) cannot
run the statements the schema needs.

> `SUPABASE_DB_URL` is only ever read by `npm run db:apply`. It carries the
> database password, so it belongs in `.env.local` and must not go to Vercel —
> the app never opens a direct connection.

## 3. Build it — one command

```
npm run setup:fresh
```

Which is: apply `supabase/schema.sql` and `supabase/demo-mode.sql` → create the
private `documents` bucket → seed Dad from the fixtures → check the demo fence.

Each SQL file is sent as a single statement string, so Postgres runs it in one
transaction: it either all lands or none of it does. Re-running says `already`
rather than half-applying anything.

Expect roughly:

```
  applied  schema.sql
  applied  demo-mode.sql
created private bucket 'documents'
  01   GP referral letter                 4 facts
  …
Seeded person <uuid> — 27 documents, 123 facts.
DEMO FENCE: READY
```

## 4. Two dashboard switches

1. **Authentication → Sign In / Providers → Anonymous sign-ins: ON.**
   Guest mode is built on it. Without it, "Have a look around first" answers
   *"Guest access is not switched on for this demo"*.
2. **Authentication → URL Configuration**
   - Site URL: `https://healthcarehelper-pi.vercel.app`
   - Redirect URLs: add `https://healthcarehelper-pi.vercel.app/**` and
     `http://localhost:3000/**`

   Only magic links need this. Guests never touch it.

## 5. Tell Vercel

Project → Settings → Environment Variables. Set the three keys from step 2
(**not** `SUPABASE_DB_URL`), plus the demo settings:

```
DEMO_CLOSES_AT=2026-08-02T18:00:00Z     # when everything shuts
DEMO_OWNER_EMAIL=you@example.com        # one heads-up, a day before
DEMO_BUDGET_AI_USD=25
DEMO_BUDGET_SPEECH_CHARS=5000
```

Redeploy — environment changes do not rebuild on their own.

## 6. Check it

```
npm run demo:check          # date set · counters live · spend so far
npm run demo:clone-probe    # guest mode's record copy, then cleans up
npm run magic-link -- you@example.com --prod
```

Then open the site: the welcome screen should offer **Have a look around
first**, and it should land you on a timeline with 27 letters on it.

---

## Notes for later

- **Sending email is Supabase's, and it is rate-limited.** A new project's
  built-in SMTP allows only a couple of magic links an hour. `npm run
  magic-link` mints links through the admin API and is not affected — use it
  for anyone else's phone. Guests need no email at all.
- **`npm run seed:reset` wipes and rebuilds.** Safe on a fresh project, and the
  way back if the demo record gets messy.
- **Free projects pause after a week idle.** Irrelevant for a demo that closes
  on a date, but do not expect to return to it a month later.
- **Old accounts do not come across.** `amira@example.com` and
  `dad@example.com` are recreated by the seed; anyone else needs a fresh magic
  link.
