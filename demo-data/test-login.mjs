// demo-data/test-login.mjs
//
// This simulates exactly what the frontend should do: sign in with the demo
// account using the ANON key (not service_role), then query data the same
// way RLS will allow. If this script sees Amira + Dad's data, the real
// login -> RLS -> query path works end-to-end, and Dev B's frontend should
// work the same way once wired up.
//
// Usage:
//   node --env-file=demo-data/.env.local demo-data/test-login.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@livingrecord.app';
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || 'demo-password-123!';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment. Add SUPABASE_ANON_KEY to demo-data/.env.local.');
  process.exit(1);
}

// IMPORTANT: this client uses the ANON key, same as the real frontend will.
// It is subject to RLS — unlike seed.mjs, which uses service_role and bypasses it.
const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function main() {
  console.log(`Signing in as ${DEMO_USER_EMAIL} (using ANON key, RLS applies)...\n`);

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
  });

  if (authError) {
    console.error('Login FAILED:', authError.message);
    process.exit(1);
  }

  console.log(`Login succeeded. auth.uid() = ${authData.user.id}\n`);

  // --- persons: should return exactly Amira + Dad (owner/carer memberships) ---
  const { data: persons, error: personsErr } = await supabase.from('persons').select('*');
  if (personsErr) {
    console.error('Query "persons" FAILED:', personsErr.message);
  } else {
    console.log(`persons visible to this login: ${persons.length}`);
    for (const p of persons) console.log(`  - ${p.display_name} (${p.id})`);
  }

  // --- documents for Dad specifically: should return 12 rows ---
  const dad = persons?.find((p) => p.display_name === 'Dad');
  if (dad) {
    const { data: docs, error: docsErr } = await supabase
      .from('documents')
      .select('doc_type, doc_date, status')
      .eq('person_id', dad.id)
      .order('doc_date');
    if (docsErr) {
      console.error('Query "documents" FAILED:', docsErr.message);
    } else {
      console.log(`\ndocuments visible for Dad: ${docs.length}`);
      for (const d of docs) console.log(`  - ${d.doc_date}  ${d.doc_type}  [${d.status}]`);
    }

    // --- a couple of fact tables, to prove the whole chain works ---
    const { data: meds } = await supabase.from('medications').select('name, current_dose').eq('person_id', dad.id);
    console.log(`\nmedications visible for Dad: ${meds?.length ?? 0}`);
    for (const m of meds ?? []) console.log(`  - ${m.name}: ${m.current_dose}`);

    const { data: loops } = await supabase.from('open_loops').select('description, state').eq('person_id', dad.id);
    console.log(`\nopen_loops visible for Dad: ${loops?.length ?? 0}`);
    for (const l of loops ?? []) console.log(`  - [${l.state}] ${l.description}`);
  }

  console.log('\nDone. If you see Amira + Dad above with real rows under Dad, the login -> RLS -> query path is working correctly.');
}

main().catch((err) => {
  console.error('\nTest failed:', err.message || err);
  process.exit(1);
});
