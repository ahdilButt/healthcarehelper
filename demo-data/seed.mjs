// demo-data/seed.mjs
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node demo-data/seed.mjs
// or, with a .env file loaded via `dotenv -e .env.local -- node demo-data/seed.mjs`
//
// This script is idempotent: re-running it deletes the demo user's existing
// persons (which cascades to every fact table via `on delete cascade`) and
// re-inserts everything fresh.
//
// Requires: npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@livingrecord.app';
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || 'demo-password-123!';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. See .env.example.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrCreateDemoUser() {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === DEMO_USER_EMAIL);
  if (existing) {
    console.log(`Using existing demo user: ${existing.id} (${DEMO_USER_EMAIL})`);
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`Created demo user: ${data.user.id} (${DEMO_USER_EMAIL} / ${DEMO_USER_PASSWORD})`);
  return data.user.id;
}

async function resetExistingDemoData(userId) {
  // Deleting persons cascades to memberships, documents, and every fact table
  // (all declared `on delete cascade` in SUPABASE-SCHEMA.sql).
  const { error } = await supabase.from('persons').delete().eq('created_by', userId);
  if (error) throw error;
  console.log('Cleared any existing demo persons for this user (cascade removed downstream rows).');
}

async function seedPersons(userId) {
  const raw = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'persons.json'), 'utf-8'));
  const personIdByRef = {};

  for (const p of raw.persons) {
    const { data, error } = await supabase
      .from('persons')
      .insert({
        display_name: p.display_name,
        managing_note: p.managing_note ?? null,
        emergency_contact: p.emergency_contact ?? null,
        dnr_status: p.dnr_status ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    personIdByRef[p.ref] = data.id;

    const { error: memErr } = await supabase.from('memberships').insert({
      user_id: userId,
      person_id: data.id,
      role: p.role,
    });
    if (memErr) throw memErr;

    console.log(`  person "${p.display_name}" (${p.ref}) -> ${data.id} [role: ${p.role}]`);
  }

  return personIdByRef;
}

async function insertFact(table, row) {
  const { error } = await supabase.from(table).insert(row);
  if (error) throw new Error(`Insert into ${table} failed: ${error.message} | row=${JSON.stringify(row)}`);
}

async function seedDocuments(personIdByRef, ownerUserId) {
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.startsWith('doc-') && f.endsWith('.json'))
    .sort();

  const medicationIdByRef = {};

  for (const file of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf-8'));
    const personId = personIdByRef[doc.person_ref];
    if (!personId) throw new Error(`Unknown person_ref "${doc.person_ref}" in ${file}`);

    const { data: docRow, error: docErr } = await supabase
      .from('documents')
      .insert({
        person_id: personId,
        kind: doc.kind,
        storage_path: `${personId}/${doc.ref}/placeholder.pdf`,
        transcript: doc.transcript ?? null,
        doc_type: doc.doc_type ?? null,
        doc_date: doc.doc_date ?? null,
        sender: doc.sender ?? null,
        status: doc.status ?? 'ready',
        created_by: ownerUserId,
      })
      .select()
      .single();
    if (docErr) throw docErr;

    const tag = doc._placeholder ? ' [PLACEHOLDER — replace with curator content]' : '';
    console.log(`  document ${doc.ref} (${doc.doc_type}) -> ${docRow.id}${tag}`);

    const facts = doc.facts || {};

    for (const c of facts.conditions ?? []) {
      await insertFact('conditions', {
        person_id: personId,
        name: c.name,
        status: c.status ?? 'active',
        source_document_id: docRow.id,
        confidence: c.confidence,
        confirmed_at: c.confirmed_at ?? null,
      });
    }

    for (const m of facts.medications ?? []) {
      const { data, error } = await supabase
        .from('medications')
        .insert({
          person_id: personId,
          name: m.name,
          current_dose: m.current_dose,
          form: m.form ?? 'tablet',
          schedule_hint: m.schedule_hint ?? null,
          rotation_sites: m.rotation_sites ?? null,
          source_document_id: docRow.id,
          confidence: m.confidence,
          confirmed_at: m.confirmed_at ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      if (m.ref) medicationIdByRef[m.ref] = data.id;
    }

    for (const mc of facts.med_change_events ?? []) {
      const medId = medicationIdByRef[mc.medication_ref];
      if (!medId) {
        throw new Error(
          `Unknown medication_ref "${mc.medication_ref}" in ${file} — make sure the medication was introduced in an earlier doc.`
        );
      }
      await insertFact('med_change_events', {
        person_id: personId,
        medication_id: medId,
        old_dose: mc.old_dose ?? null,
        new_dose: mc.new_dose,
        changed_on: mc.changed_on ?? doc.doc_date,
        source_document_id: docRow.id,
        confidence: mc.confidence,
        confirmed_at: mc.confirmed_at ?? null,
      });
      // Keep the medication's current_dose in sync with the latest change event.
      const { error: updErr } = await supabase
        .from('medications')
        .update({ current_dose: mc.new_dose })
        .eq('id', medId);
      if (updErr) throw updErr;
    }

    for (const a of facts.allergies ?? []) {
      await insertFact('allergies', {
        person_id: personId,
        substance: a.substance,
        reaction: a.reaction ?? null,
        source_document_id: docRow.id,
        confidence: a.confidence,
        confirmed_at: a.confirmed_at ?? null,
      });
    }

    for (const r of facts.results ?? []) {
      await insertFact('results', {
        person_id: personId,
        name: r.name,
        value: r.value ?? null,
        value_text: r.value_text ?? null,
        unit: r.unit ?? null,
        ref_low: r.ref_low ?? null,
        ref_high: r.ref_high ?? null,
        flagged: r.flagged ?? false,
        result_date: r.result_date ?? doc.doc_date,
        source_document_id: docRow.id,
        confidence: r.confidence,
        confirmed_at: r.confirmed_at ?? null,
      });
    }

    for (const ap of facts.appointments ?? []) {
      await insertFact('appointments', {
        person_id: personId,
        title: ap.title,
        location: ap.location ?? null,
        starts_at: ap.starts_at ?? null,
        source_document_id: docRow.id,
        confidence: ap.confidence,
        confirmed_at: ap.confirmed_at ?? null,
      });
    }

    for (const ol of facts.open_loops ?? []) {
      await insertFact('open_loops', {
        person_id: personId,
        loop_type: ol.loop_type,
        description: ol.description,
        expected_date: ol.expected_date ?? null,
        state: ol.state ?? 'waiting',
        source_document_id: docRow.id,
        confidence: ol.confidence,
        confirmed_at: ol.confirmed_at ?? null,
      });
    }
  }
}

async function main() {
  console.log('Seeding demo data into Supabase...\n');

  const userId = await getOrCreateDemoUser();
  await resetExistingDemoData(userId);

  console.log('\nInserting persons + memberships:');
  const personIdByRef = await seedPersons(userId);

  console.log('\nInserting documents + fact tables:');
  await seedDocuments(personIdByRef, userId);

  console.log('\nDone.');
  console.log(`Demo login: ${DEMO_USER_EMAIL} / ${DEMO_USER_PASSWORD}`);
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message || err);
  process.exit(1);
});
