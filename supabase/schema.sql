-- ============================================================
-- HealthcareHelper — Supabase schema (CONTRACT: frozen 2026-07-25)
-- Derived 1:1 from SPEC-FINAL.md §2. Changes require a contract
-- bump agreed by both devs (see BUILD-GUIDE.md).
-- Apply with: supabase db push  (or paste into the SQL editor)
-- ============================================================

-- ---------- Enums ----------
create type membership_role as enum ('owner','patient','carer');   -- viewers have NO accounts: viewer = capsule token
create type document_kind   as enum ('letter_photo','pdf','voice_note','box_photo');
create type document_status as enum ('processing','ready','needs_look','merged');
create type med_form        as enum ('tablet','capsule','patch','gel','injection','inhaler','liquid','other');
create type loop_type       as enum ('referral','test','letter','follow_up','other');
create type loop_state      as enum ('waiting','done','overdue');
create type capsule_kind    as enum ('doctor_brief','paramedic','family');
create type notif_type      as enum ('reminder','what_changed');
create type notif_channel   as enum ('sms','email');
create type message_role    as enum ('user','assistant');

-- ---------- Core people ----------
create table persons (
  id                uuid primary key default gen_random_uuid(),
  display_name      text not null,                 -- "Dad"
  managing_note     text,                          -- optional "what are they managing?"
  emergency_contact jsonb,                         -- {name, phone, relationship}
  dnr_status        boolean,                       -- set manually; feeds paramedic capsule
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now()
);

create table memberships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  person_id  uuid not null references persons(id) on delete cascade,
  role       membership_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, person_id)
);

create table invites (                              -- Dad joins via this link
  token      text primary key,                      -- >=128-bit base64url, server-generated
  person_id  uuid not null references persons(id) on delete cascade,
  role       membership_role not null default 'patient',
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  used_by    uuid references auth.users(id),
  used_at    timestamptz
);

-- ---------- Documents (immutable originals) ----------
create table documents (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references persons(id) on delete cascade,
  kind         document_kind not null,
  storage_path text not null,                      -- private bucket 'documents': {person_id}/{doc_id}/{filename}
  transcript   text,                               -- Stage A output; null until transcribed
  doc_type     text,                               -- 'clinic_letter','discharge_summary','blood_panel',...
  doc_date     date,
  sender       text,                               -- "Cardiology, St Mary's NHS Trust" (fictional)
  status       document_status not null default 'processing',
  merged_into  uuid references documents(id),      -- set when user chose "merge"
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

-- ---------- Extracted facts ----------
-- LAW (SPEC-FINAL §2): every fact row carries person_id + source_document_id + confidence.
-- App rule: "confirmed" = confidence >= 0.80 OR confirmed_at IS NOT NULL.
-- Unconfirmed facts NEVER appear in capsules or what-changed alerts.

create table conditions (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references persons(id) on delete cascade,
  name               text not null,
  status             text not null default 'active',       -- 'active','resolved'
  source_document_id uuid not null references documents(id),
  page_region        jsonb,                                 -- {page, bbox?} optional
  confidence         numeric(3,2) not null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create table medications (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references persons(id) on delete cascade,
  name               text not null,
  current_dose       text not null,                         -- "5mg once daily"
  form               med_form not null default 'tablet',
  schedule_hint      text,                                  -- free text from letter, seeds routines
  rotation_sites     text[],                                -- e.g. {'left hip','right hip','left arm','right arm'} for patches
  is_active          boolean not null default true,
  source_document_id uuid not null references documents(id),
  page_region        jsonb,
  confidence         numeric(3,2) not null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create table med_change_events (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references persons(id) on delete cascade,
  medication_id      uuid not null references medications(id) on delete cascade,
  old_dose           text,
  new_dose           text not null,
  changed_on         date,
  source_document_id uuid not null references documents(id),
  confidence         numeric(3,2) not null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create table allergies (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references persons(id) on delete cascade,
  substance          text not null,
  reaction           text,
  source_document_id uuid not null references documents(id),
  confidence         numeric(3,2) not null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create table results (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references persons(id) on delete cascade,
  name               text not null,                          -- "eGFR"
  value              numeric,                                -- numeric results
  value_text         text,                                   -- non-numeric ("clear", "no acute changes")
  unit               text,                                   -- "mL/min/1.73m²"
  ref_low            numeric,
  ref_high           numeric,
  flagged            boolean not null default false,         -- true ONLY if the letter itself flags it
  result_date        date,
  source_document_id uuid not null references documents(id),
  confidence         numeric(3,2) not null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create table appointments (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references persons(id) on delete cascade,
  title              text not null,
  location           text,
  starts_at          timestamptz,
  source_document_id uuid not null references documents(id),
  confidence         numeric(3,2) not null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create table open_loops (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references persons(id) on delete cascade,
  loop_type          loop_type not null,
  description        text not null,                          -- "Cardiology will write within 3 weeks"
  expected_date      date,
  state              loop_state not null default 'waiting',  -- cron flips waiting→overdue past expected_date
  source_document_id uuid not null references documents(id),
  confidence         numeric(3,2) not null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);

-- ---------- Corrections overlay (AI output is immutable) ----------
create table corrections (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references persons(id) on delete cascade,
  fact_table      text not null,                             -- 'medications','results',...
  fact_id         uuid not null,
  field           text not null,                             -- 'current_dose'
  corrected_value text not null,
  corrected_by    uuid not null references auth.users(id),
  created_at      timestamptz not null default now()
);
-- Read rule (app layer): display = latest correction for (fact_table,fact_id,field) else the AI value; show "edited" mark when a correction exists.

-- ---------- Routines ----------
create table routines (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references persons(id) on delete cascade,
  medication_id uuid not null references medications(id) on delete cascade,
  times         jsonb not null,                              -- ["08:00","20:00"] local (Europe/London)
  enabled       boolean not null default true,
  created_at    timestamptz not null default now()
);

create table taken_events (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references persons(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  due_at     timestamptz not null,
  taken_at   timestamptz,                                    -- null = not yet / missed
  site       text,                                           -- patch site used, from medications.rotation_sites
  marked_by  uuid references auth.users(id)
);

-- ---------- Capsules ----------
create table capsules (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references persons(id) on delete cascade,
  kind       capsule_kind not null,
  token      text not null unique,                           -- >=128-bit base64url; the ONLY public credential
  expires_at timestamptz,                                    -- doctor_brief +24h · paramedic NULL · family +30d
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table capsule_views (
  id         uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references capsules(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  user_agent text
);

-- ---------- Conversations (Ask) ----------
create table conversations (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references persons(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            message_role not null,
  content         text not null,
  citations       jsonb,                                     -- [{fact_table, fact_id, document_id, label}]
  gp_questions    jsonb,                                     -- ["Ask about...", ...] on assistant messages
  created_at      timestamptz not null default now()
);

-- ---------- Notifications ----------
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references persons(id) on delete cascade,
  target_user   uuid not null references auth.users(id),
  notif_type    notif_type not null,
  channel       notif_channel not null,
  payload       jsonb not null,                              -- {body, cites_document_id?}
  scheduled_for timestamptz not null,
  sent_at       timestamptz,
  status        text not null default 'pending'              -- 'pending','sent','failed'
);

-- ---------- Indexes ----------
create index on memberships (person_id);
create index on documents (person_id, created_at desc);
create index on conditions (person_id);
create index on medications (person_id) where is_active;
create index on med_change_events (person_id, created_at desc);
create index on results (person_id, name, result_date);
create index on appointments (person_id, starts_at);
create index on open_loops (person_id, state, expected_date);
create index on taken_events (person_id, due_at);
create index on notifications (status, scheduled_for);
create index on capsule_views (capsule_id, viewed_at desc);

-- ============================================================
-- SECURITY (SPEC-FINAL §2 RLS intent — "completely secure" posture)
-- ============================================================
-- Principles:
--   1. RLS ON for every table. NO anon policies anywhere.
--   2. The public capsule page and invite-accept run SERVER-SIDE with the
--      service-role key after validating the token — anon key can read nothing.
--   3. Service-role key lives only in Vercel server env. Never shipped to client.
--   4. Documents bucket is PRIVATE; files served via short-lived signed URLs
--      generated server-side after a membership check.

create or replace function is_member(p uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from memberships m where m.user_id = auth.uid() and m.person_id = p) $$;

create or replace function is_owner(p uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from memberships m where m.user_id = auth.uid() and m.person_id = p and m.role = 'owner') $$;

alter table persons          enable row level security;
alter table memberships      enable row level security;
alter table invites          enable row level security;
alter table documents        enable row level security;
alter table conditions       enable row level security;
alter table medications      enable row level security;
alter table med_change_events enable row level security;
alter table allergies        enable row level security;
alter table results          enable row level security;
alter table appointments     enable row level security;
alter table open_loops       enable row level security;
alter table corrections      enable row level security;
alter table routines         enable row level security;
alter table taken_events     enable row level security;
alter table capsules         enable row level security;
alter table capsule_views    enable row level security;
alter table conversations    enable row level security;
alter table messages         enable row level security;
alter table notifications    enable row level security;

-- persons: members read; creator inserts; owner updates
create policy persons_select on persons for select using (is_member(id) or created_by = auth.uid());
create policy persons_insert on persons for insert with check (created_by = auth.uid());
create policy persons_update on persons for update using (is_owner(id));

-- memberships: members see the circle; inserts happen server-side (invite accept / person create)
create policy memberships_select on memberships for select using (is_member(person_id));

-- invites: owner creates/sees; accept is server-side (service role)
create policy invites_select on invites for select using (is_owner(person_id));
create policy invites_insert on invites for insert with check (is_owner(person_id));

-- generic member policies for person-scoped tables
create policy documents_rw    on documents    for all using (is_member(person_id)) with check (is_member(person_id));
create policy conditions_rw   on conditions   for all using (is_member(person_id)) with check (is_member(person_id));
create policy medications_rw  on medications  for all using (is_member(person_id)) with check (is_member(person_id));
create policy medchg_rw       on med_change_events for all using (is_member(person_id)) with check (is_member(person_id));
create policy allergies_rw    on allergies    for all using (is_member(person_id)) with check (is_member(person_id));
create policy results_rw      on results      for all using (is_member(person_id)) with check (is_member(person_id));
create policy appointments_rw on appointments for all using (is_member(person_id)) with check (is_member(person_id));
create policy loops_rw        on open_loops   for all using (is_member(person_id)) with check (is_member(person_id));
create policy corrections_rw  on corrections  for all using (is_member(person_id)) with check (is_member(person_id));
create policy routines_rw     on routines     for all using (is_member(person_id)) with check (is_member(person_id));
create policy taken_rw        on taken_events for all using (is_member(person_id)) with check (is_member(person_id));
create policy convos_rw       on conversations for all using (is_member(person_id)) with check (is_member(person_id));
create policy messages_rw     on messages     for all using (exists (select 1 from conversations c where c.id = conversation_id and is_member(c.person_id)))
                                             with check (exists (select 1 from conversations c where c.id = conversation_id and is_member(c.person_id)));

-- capsules: members manage; revoke-others restricted to owner at the API layer
create policy capsules_select on capsules for select using (is_member(person_id));
create policy capsules_insert on capsules for insert with check (is_member(person_id));
create policy capsules_update on capsules for update using (is_member(person_id));

-- capsule_views: members read the log; INSERTS are service-role only (public page)
create policy capviews_select on capsule_views for select
  using (exists (select 1 from capsules c where c.id = capsule_id and is_member(c.person_id)));

-- notifications: you see what targets you, plus members of the person
create policy notif_select on notifications for select using (target_user = auth.uid() or is_member(person_id));

-- ---------- Storage ----------
-- Bucket 'documents' (PRIVATE). Path convention: {person_id}/{document_id}/{filename}
-- Policies (storage.objects): members of the first path folder may insert/select;
-- in practice the app uploads and reads via server routes + signed URLs, so these
-- policies are the belt to the server-side braces.
-- insert into storage.buckets (id, name, public) values ('documents','documents', false);
-- create policy docs_upload on storage.objects for insert to authenticated
--   with check (bucket_id = 'documents' and is_member(((storage.foldername(name))[1])::uuid));
-- create policy docs_read on storage.objects for select to authenticated
--   using (bucket_id = 'documents' and is_member(((storage.foldername(name))[1])::uuid));

-- ---------- Cron (reminders + overdue loops) ----------
-- pg_cron (Supabase: enable extensions pg_cron + pg_net), calls the Vercel endpoint
-- every minute with the shared secret. See API-CONTRACTS.md /api/cron/tick.
-- select cron.schedule('tick','* * * * *',
--   $$ select net.http_post('https://<app-domain>/api/cron/tick',
--        headers := jsonb_build_object('x-cron-secret','<CRON_SECRET>')) $$);

-- ---------- App-layer rules the schema expects (not enforced in SQL) ----------
-- * CONFIRMED_THRESHOLD = 0.80 (constant in code). Capsule + alert queries filter:
--   (confidence >= 0.80 OR confirmed_at IS NOT NULL).
-- * Documents are immutable: transcript written once by the pipeline; user fixes go to corrections.
-- * What-changed: after Stage B writes a med_change_event, the API queues notifications
--   (SMS both members + timeline card is the event itself).
-- * Merge: losing document gets status='merged', merged_into=winner; its facts are re-pointed or suppressed by the merge routine.
