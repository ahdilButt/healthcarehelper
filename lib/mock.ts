// Single source of mock data for the whole UI. No fetching, no auth, no persistence.

export type Person = {
  id: string
  label: string
  shortLabel: string
  name: string
  relationship: string
  managing: string
}

export const people: Person[] = [
  {
    id: 'dad',
    label: "Dad's story",
    shortLabel: 'Dad',
    name: 'George Hassan',
    relationship: 'Dad',
    managing: 'Heart failure, type 2 diabetes, kidney function being watched',
  },
  {
    id: 'you',
    label: 'You',
    shortLabel: 'You',
    name: 'Amira Hassan',
    relationship: 'You',
    managing: 'Nothing being watched right now',
  },
]

export const carer = {
  name: 'Amira',
  fullName: 'Amira Hassan',
  phone: '07700 900 118',
  relationship: 'Daughter',
}

export const allergies = [{ name: 'Penicillin', note: 'Rash and swelling, 2019' }]

/* ---------------------------------- Timeline --------------------------------- */

export type TimelineKind =
  | 'letter'
  | 'result'
  | 'med-change'
  | 'watch'
  | 'needs-a-look'
  | 'processing'

export type TimelineFact = { label: string; value: string; edited?: boolean }

export type TimelineItem = {
  id: string
  kind: TimelineKind
  month: string
  date: string
  header: string
  payload: string
  sub?: string
  direction?: 'down' | 'up'
  statusPill?: { text: string; tone: 'warn' | 'good' | 'alert' }
  source?: string
  thumbnail?: string
  facts?: TimelineFact[]
  plainEnglish?: string
  progressLine?: string
}

export const timeline: TimelineItem[] = [
  {
    id: 't-processing',
    kind: 'processing',
    month: 'May 2026',
    date: 'Just now',
    header: 'Reading the letter you just added',
    payload: 'Reading the letter…',
    progressLine: 'found 3 medications · 1 result · 1 thing to watch',
  },
  {
    id: 't-needs-look',
    kind: 'needs-a-look',
    month: 'May 2026',
    date: '22 May',
    header: 'Diabetes nurse note',
    payload: 'We couldn’t read one line — tap to check',
    thumbnail: '/letter-scan.png',
    source: 'from a photo you added · 22 May',
    facts: [
      { label: 'What we read', value: 'Metformin 1g twice daily — continue' },
      { label: 'The line we’re unsure about', value: 'Review in ? weeks' },
    ],
    plainEnglish:
      'The nurse was happy with how Dad is getting on with Metformin and wants to see him again — but the handwriting for how many weeks isn’t clear enough for us to be sure.',
  },
  {
    id: 't-letter',
    kind: 'letter',
    month: 'May 2026',
    date: '12 May',
    header: 'Heart clinic letter',
    payload: 'Dr Ayesha Nair, cardiology — St Thomas’ Hospital, London',
    source: 'from the cardiology letter · 12 May',
    thumbnail: '/letter-scan.png',
    facts: [
      { label: 'Seen by', value: 'Dr Ayesha Nair, cardiology' },
      { label: 'Reason for the visit', value: 'Six-month heart failure review' },
      { label: 'Weight', value: '84.2 kg' },
      { label: 'Blood pressure', value: '118/74' },
      { label: 'Next appointment', value: 'November 2026' },
    ],
    plainEnglish:
      'Dad’s heart is being managed well but his blood pressure had room to come down, so the doctor increased one of his heart tablets. Because that tablet can affect the kidneys, they took a blood test on the day and want another one in six weeks. He’s also being referred to a kidney specialist as a precaution — not because anything has gone wrong.',
  },
  {
    id: 't-result',
    kind: 'result',
    month: 'May 2026',
    date: '12 May',
    header: 'Kidney check result',
    payload: '46 mL/min/1.73m²',
    sub: 'slightly lower than March',
    direction: 'down',
    source: 'from the cardiology letter · 12 May',
    facts: [
      { label: 'What was measured', value: 'Kidney filtering rate (eGFR)' },
      { label: 'This time', value: '46 mL/min/1.73m²', edited: true },
      { label: 'In March', value: '52 mL/min/1.73m²' },
      { label: 'Taken on', value: '12 May 2026' },
    ],
    plainEnglish:
      'This number describes how well the kidneys are filtering. It has drifted down a little since March. The clinic isn’t worried today, but they want it checked again in six weeks and they’re watching it because of the heart tablets.',
  },
  {
    id: 't-med-change',
    kind: 'med-change',
    month: 'May 2026',
    date: '12 May',
    header: 'Heart medicine dose went up',
    payload: 'Ramipril is now 5mg (was 2.5mg)',
    source: 'from the cardiology letter · 12 May',
    facts: [
      { label: 'Medicine', value: 'Ramipril' },
      { label: 'New dose', value: '5mg once in the morning' },
      { label: 'Old dose', value: '2.5mg once in the morning' },
      { label: 'Started', value: '12 May 2026' },
      { label: 'Why', value: 'To bring blood pressure down a little further' },
    ],
    plainEnglish:
      'The dose of Dad’s heart tablet was doubled. It’s a common step. The clinic asked for a blood test six weeks after the change to make sure his kidneys are happy with it.',
  },
  {
    id: 't-watch',
    kind: 'watch',
    month: 'May 2026',
    date: '12 May',
    header: 'Kidney specialist referral',
    payload: 'Sent by the heart clinic — no date yet',
    statusPill: { text: 'Waiting · 8 weeks', tone: 'warn' },
    source: 'from the cardiology letter · 12 May',
    facts: [
      { label: 'Who to', value: 'Renal clinic, St Thomas’ Hospital, London' },
      { label: 'Sent', value: '12 May 2026' },
      { label: 'Usual wait', value: 'Around 8 weeks' },
      { label: 'Where it’s up to', value: 'Waiting for an appointment letter' },
    ],
    plainEnglish:
      'A referral is a request for another team to take a look. The heart clinic asked the kidney team to see Dad as a precaution. Nothing needs doing while you wait, but you can ring the clinic if nothing arrives.',
  },
  {
    id: 't-diabetes-letter',
    kind: 'letter',
    month: 'April 2026',
    date: '28 April',
    header: 'Diabetes review letter',
    payload: 'Meadow Lane Surgery — yearly check',
    source: 'from the surgery letter · 28 April',
    facts: [
      { label: 'Seen by', value: 'Nurse practitioner Kim Boateng' },
      { label: 'Feet check', value: 'Normal, low risk' },
      { label: 'Eye screening', value: 'Booked for July 2026' },
    ],
    plainEnglish:
      'This was Dad’s yearly diabetes check. Everything they looked at was steady and his tablets stayed the same. His eye screening appointment is in July.',
  },
  {
    id: 't-hba1c',
    kind: 'result',
    month: 'April 2026',
    date: '28 April',
    header: 'Long-term sugar check',
    payload: '58 mmol/mol',
    sub: 'about the same as last year',
    source: 'from the surgery letter · 28 April',
    facts: [
      { label: 'What was measured', value: 'Average blood sugar over 3 months (HbA1c)' },
      { label: 'This time', value: '58 mmol/mol' },
      { label: 'Last year', value: '59 mmol/mol' },
    ],
    plainEnglish:
      'This gives a picture of Dad’s blood sugar over the last few months rather than on one day. It has stayed steady, which is why nothing was changed.',
  },
  {
    id: 't-march-kidney',
    kind: 'result',
    month: 'March 2026',
    date: '3 March',
    header: 'Kidney check result',
    payload: '52 mL/min/1.73m²',
    sub: 'steady since December',
    source: 'from the blood test text · 3 March',
    facts: [
      { label: 'What was measured', value: 'Kidney filtering rate (eGFR)' },
      { label: 'This time', value: '52 mL/min/1.73m²' },
      { label: 'In December', value: '53 mL/min/1.73m²' },
    ],
    plainEnglish:
      'A routine blood test at the surgery. The kidney number was holding steady at this point, which is useful to compare with May.',
  },
]

export const timelineMonths = Array.from(new Set(timeline.map((t) => t.month)))

/* ------------------------------ Adding a photo ------------------------------ */

export const photoLibrary = [
  { id: 'lib-letter', src: '/letter-scan.png', label: 'Clinic letter', when: 'Today 09:14' },
  { id: 'lib-results', src: '/results-slip.png', label: 'Results slip', when: 'Yesterday 17:40' },
  { id: 'lib-label', src: '/pharmacy-label.png', label: 'Pharmacy label', when: 'Fri 11:02' },
]

let captureCount = 0

export function newCapture(personLabel: string): TimelineItem {
  captureCount += 1
  return {
    id: `t-capture-${captureCount}`,
    kind: 'processing',
    month: 'May 2026',
    date: 'Just now',
    header: `Reading the photo you added to ${personLabel}`,
    payload: 'Reading the photo…',
    progressLine: 'checking the dates, doses and results',
  }
}

/* ----------------------------------- Today ---------------------------------- */

export type MedSlot = 'Morning' | 'Afternoon' | 'Evening'

export type Med = {
  id: string
  name: string
  dose: string
  slot: MedSlot
  taken: boolean
  missed?: boolean
  isPatch?: boolean
  patchSiteToday?: string
  note?: string
}

export const meds: Med[] = [
  { id: 'ramipril', name: 'Ramipril', dose: '5mg · one tablet', slot: 'Morning', taken: true, note: 'Dose went up in May' },
  { id: 'bisoprolol', name: 'Bisoprolol', dose: '2.5mg · one tablet', slot: 'Morning', taken: true },
  { id: 'furosemide', name: 'Furosemide', dose: '40mg · one tablet', slot: 'Morning', taken: false, missed: true },
  { id: 'metformin-am', name: 'Metformin', dose: '1g · with breakfast', slot: 'Morning', taken: true },
  {
    id: 'gtn-patch',
    name: 'GTN patch',
    dose: '5mg · one patch',
    slot: 'Morning',
    taken: false,
    isPatch: true,
    patchSiteToday: 'Right hip today',
  },
  { id: 'metformin-pm', name: 'Metformin', dose: '1g · with dinner', slot: 'Evening', taken: false },
  { id: 'atorvastatin', name: 'Atorvastatin', dose: '20mg · one tablet', slot: 'Evening', taken: false },
]

export const todayDate = 'Sunday 24 May'
export const todayBadgeCount = 1

/* --------------------------------- Open loops -------------------------------
 * Shaped exactly like the `open_loops` table so this swaps to a real query
 * later: select * from open_loops where loop_type = 'follow_up' and state = 'overdue'.
 * A loop is only ever cleared by evidence — state moves to 'done' when a new
 * document confirms it happened. There is no user-facing dismiss.
 * -------------------------------------------------------------------------- */

export type OpenLoop = {
  id: string
  person_id: string
  loop_type: 'follow_up' | 'referral' | 'test' | 'appointment'
  description: string
  promised_on: string
  due_on: string
  days_overdue: number
  state: 'open' | 'overdue' | 'done'
}

export const openLoops: OpenLoop[] = [
  {
    id: 'loop-bp',
    person_id: 'dad',
    loop_type: 'follow_up',
    description: 'GP blood pressure check, 2 weeks after discharge',
    promised_on: '2026-04-26',
    due_on: '2026-05-10',
    days_overdue: 14,
    state: 'overdue',
  },
  {
    id: 'loop-kidney-test',
    person_id: 'dad',
    loop_type: 'test',
    description: 'Repeat kidney blood test, 6 weeks after the dose change',
    promised_on: '2026-05-12',
    due_on: '2026-06-23',
    days_overdue: 0,
    state: 'open',
  },
  {
    id: 'loop-renal',
    person_id: 'dad',
    loop_type: 'referral',
    description: 'Kidney specialist appointment letter',
    promised_on: '2026-05-12',
    due_on: '2026-07-07',
    days_overdue: 0,
    state: 'open',
  },
]

export function overdueFollowUps(personId: string) {
  return openLoops.filter(
    (loop) => loop.person_id === personId && loop.loop_type === 'follow_up' && loop.state === 'overdue',
  )
}

/* --------------------------------- Body map --------------------------------- */

export const patchPlan = {
  last: { label: 'Last: left hip', site: 'left-hip' },
  next: { label: 'This time: right hip', site: 'right-hip' },
}

export const patchHistory = [
  { date: 'Sat 23 May', site: 'Left hip' },
  { date: 'Fri 22 May', site: 'Right upper arm' },
  { date: 'Thu 21 May', site: 'Left upper arm' },
  { date: 'Wed 20 May', site: 'Right hip' },
  { date: 'Tue 19 May', site: 'Left hip' },
  { date: 'Mon 18 May', site: 'Right upper arm' },
]

/* ------------------------------------ Ask ----------------------------------- */

export type AskMessage = {
  id: string
  from: 'you' | 'helper'
  text: string
  sources?: string[]
  questions?: string[]
}

export const askThread: AskMessage[] = [
  {
    id: 'a1',
    from: 'you',
    text: 'What’s actually wrong with Dad’s kidneys?',
  },
  {
    id: 'a2',
    from: 'helper',
    text:
      'Nothing has gone wrong suddenly — his kidneys are just filtering a little more slowly than they were. In March the filtering number was 52, and when it was checked again on 12 May it was 46. That’s a small drift downwards rather than a jump.\n\nTwo things are relevant. His heart tablet, Ramipril, went up from 2.5mg to 5mg on the same day, and that tablet can nudge this number down for a while. He also takes Furosemide, which shifts fluid, so how much he drinks matters too.\n\nThe clinic asked for another blood test six weeks after the dose change, and they sent a referral to the kidney team as a precaution. That’s the plan being followed — it isn’t a sign that something urgent is happening.',
    sources: ['Kidney letter · 12 May', 'Blood test text · 3 March'],
    questions: [
      'Is the drop in the kidney number expected after increasing Ramipril?',
      'When exactly should the follow-up blood test be booked?',
      'Should Dad be drinking more or less fluid while on Furosemide?',
    ],
  },
]

export const askSuggestions = [
  'Why did the heart dose go up?',
  'What should I do if he misses his water tablet?',
  'What does 46 mean for the kidneys?',
]

/* ----------------------------------- Share ---------------------------------- */

export type CapsulePreset = {
  slug: 'doctor' | 'paramedic' | 'family'
  title: string
  blurb: string
  expiry: string
  includes: string[]
  hides: string[]
}

export const capsulePresets: CapsulePreset[] = [
  {
    slug: 'doctor',
    title: 'Doctor brief',
    blurb: 'One page for any GP or A&E — expires in 24h',
    expiry: 'Expires in 24 hours',
    includes: [
      'Allergies — penicillin',
      'Every medicine Dad takes now, with doses',
      'What’s being managed — heart failure, type 2 diabetes, kidney function',
      'Recent results with their dates',
      'Anything waiting — the kidney specialist referral',
    ],
    hides: ['Photos of letters', 'Your notes and corrections', 'Anything you asked here'],
  },
  {
    slug: 'paramedic',
    title: 'Paramedic card',
    blurb: 'Emergency essentials behind a QR — never expires until you turn it off',
    expiry: 'Stays on until you turn it off',
    includes: [
      'Allergies in large type',
      'Heart and water tablets with doses',
      'What’s being managed',
      'Amira’s phone number',
      'Resuscitation wishes',
    ],
    hides: ['Results and dates', 'Letters', 'Appointments'],
  },
  {
    slug: 'family',
    title: 'Family view',
    blurb: 'Meds and appointments only — 30 days',
    expiry: 'Expires in 30 days',
    includes: ['Medicines and when they’re taken', 'Upcoming appointments'],
    hides: ['Results', 'Letters', 'Allergies and conditions'],
  },
]

// Each capsule gets its own token, so the three views never share a link.
export const capsuleTokens: Record<CapsulePreset['slug'], string> = {
  doctor: 'q7fd2m',
  paramedic: 'x4bn9k',
  family: 'h6cw3t',
}

export function shareLinkFor(slug: CapsulePreset['slug']) {
  return `healthcarehelper.uk/c/${capsuleTokens[slug]}`
}

export const openLog = [
  { who: 'Opened on a phone', where: 'Southwark, London', when: 'Tue 14:02' },
  { who: 'Opened on a phone', where: 'Lambeth, London', when: 'Tue 13:58' },
]

/* ------------------------------- Capsule page ------------------------------- */

export const capsuleMeds = [
  { name: 'Ramipril', dose: '5mg', when: 'Once each morning', note: 'Increased from 2.5mg on 12 May 2026' },
  { name: 'Bisoprolol', dose: '2.5mg', when: 'Once each morning', note: '' },
  { name: 'Furosemide', dose: '40mg', when: 'Once each morning', note: '' },
  { name: 'Metformin', dose: '1g', when: 'Twice daily with food', note: '' },
  { name: 'Atorvastatin', dose: '20mg', when: 'Once each evening', note: '' },
  { name: 'Glyceryl trinitrate patch', dose: '5mg', when: 'One patch each morning', note: 'Site rotated: hips and upper arms' },
]

export const capsuleProblems = [
  { name: 'Heart failure', detail: 'Under cardiology, St Thomas’ Hospital, London — reviewed 12 May 2026' },
  { name: 'Type 2 diabetes', detail: 'Managed at Meadow Lane Surgery — reviewed 28 April 2026' },
  { name: 'Reduced kidney function', detail: 'Monitored — eGFR 46 on 12 May 2026' },
]

export const capsuleResults = [
  { name: 'eGFR (kidney filtering)', value: '46 mL/min/1.73m²', date: '12 May 2026' },
  { name: 'eGFR (kidney filtering)', value: '52 mL/min/1.73m²', date: '3 March 2026' },
  { name: 'HbA1c', value: '58 mmol/mol', date: '28 April 2026' },
  { name: 'Blood pressure', value: '118/74', date: '12 May 2026' },
]

export const capsuleInFlight = [
  { name: 'Renal clinic referral', detail: 'Sent 12 May 2026 by cardiology — awaiting appointment (approx. 8 weeks)' },
  { name: 'Repeat kidney blood test', detail: 'Requested 6 weeks after 12 May 2026 dose change' },
]

export const capsuleAppointments = [
  { name: 'Diabetic eye screening', detail: 'July 2026 — letter to follow' },
  { name: 'Heart clinic review', detail: 'November 2026, St Thomas’ Hospital, London' },
]

export const emergency = {
  contact: 'Amira Hassan (daughter) · 07700 900 118',
  resus: 'No DNACPR in place',
  gp: 'Meadow Lane Surgery, Southwark, London · 020 7946 0022',
  dob: '4 February 1949',
  nhs: '485 777 3456',
}
