# API-CONTRACTS.md — HealthcareHelper route signatures
*CONTRACT: frozen 2026-07-25, derived from SPEC-FINAL.md. Dev A and Dev B build to these signatures independently; changes require a contract bump agreed by both (see BUILD-GUIDE.md). Next.js App Router route handlers.*

**Conventions**
- Auth: Supabase session cookie. Every route requires a signed-in member of `personId` unless marked PUBLIC or SYSTEM.
- Error envelope, always: `{ "error": { "code": string, "message": string } }` — codes: `unauthorized` · `forbidden` · `not_found` · `invalid_input` · `expired` · `revoked` · `rate_limited` · `processing_failed`.
- All request/response bodies JSON unless noted. IDs are UUIDs. Dates ISO-8601.
- `CONFIRMED_THRESHOLD = 0.80` — list endpoints return `confirmed: boolean` per fact; capsule + alert paths filter server-side.

## People & access — owner: Dev A
| Route | Auth | Input | Output |
|---|---|---|---|
| `POST /api/persons` | signed-in | `{displayName, managingNote?}` | `{person}` — creates person + owner membership |
| `GET /api/persons` | signed-in | — | `{persons: [{id, displayName, role}]}` |
| `POST /api/invites` | owner | `{personId, role: 'patient'\|'carer', expiresInHours?=72}` | `{inviteUrl}` |
| `POST /api/invites/accept` | signed-in (SYSTEM: service role after token check) | `{token}` | `{personId, role}` — 410 `expired` if past expiry/used |

## Documents & ingest — owner: Dev A
| Route | Auth | Input | Output |
|---|---|---|---|
| `POST /api/documents` | member | multipart: `personId`, `kind`, `file` (or `audio` for voice_note) | `{documentId, status:'processing'}` — kicks pipeline async |
| `GET /api/documents/:id` | member | — | `{document, narration: {medications:3, results:1, loops:1}?, duplicateOf?: documentId}` — poll for the live-narration card |
| `POST /api/documents/:id/merge` | member | `{action:'merge'\|'keep', duplicateOfId}` | `{status}` |
| `GET /api/documents/:id/file` | member | — | 302 → short-lived signed URL (view original) |
| `GET /api/persons/:id/timeline` | member | `?cursor=&limit=30` | `{items: [TimelineItem], nextCursor?}` — merged feed: documents, facts, med_change_events, open_loops, sorted desc; each item carries `sourceChip {documentId, label}` |

`TimelineItem = { itemType: 'letter'|'result'|'med_change'|'open_loop'|'needs_look'|'processing', id, personId, humanTitle, payloadLine, date, confirmed, sourceChip }`

## Facts & corrections — owner: Dev A
| Route | Auth | Input | Output |
|---|---|---|---|
| `GET /api/facts/:table/:id` | member | — | `{fact, corrections: [], displayValue, edited: boolean, document: {id, transcriptExcerpt}}` — detail sheet |
| `POST /api/facts/:table/:id/correct` | member | `{field, value}` | `{correction}` — overlay, never overwrites |
| `POST /api/facts/:table/:id/confirm` | member | — | `{confirmedAt}` — clears amber |

`:table ∈ conditions|medications|med_change_events|allergies|results|appointments|open_loops`

## Ask — owner: Dev B
| Route | Auth | Input | Output |
|---|---|---|---|
| `POST /api/ask` | member | `{personId, conversationId?, question}` | `{conversationId, message: {content, citations: [{factTable, factId, documentId, label}], gpQuestions: string[]}}` — system prompt embeds the product law; not-in-record → honest answer, `citations: []`; unconfirmed facts caveated in `content` |
| `GET /api/conversations/:personId` | member | — | `{conversations: [{id, messages}]}` |
| `GET /api/documents/:id/translate` | member | — | `{whatItSays, whatChanged, whatHappensNext}` — letter translation for the detail sheet |

## Routines & Today — owner: Dev B
| Route | Auth | Input | Output |
|---|---|---|---|
| `POST /api/routines` | member | `{personId, medicationId, times: ["08:00","20:00"]}` | `{routine}` |
| `PATCH /api/routines/:id` | member | `{times?, enabled?}` | `{routine}` |
| `GET /api/today/:personId` | member | `?date=` | `{groups: {morning: [DueItem], afternoon: [], evening: []}, badgeCount}` |
| `POST /api/taken` | member | `{routineId, dueAt, site?}` | `{takenEvent, nextSite?}` — patch meds rotate `site` from `rotation_sites` |

`DueItem = { routineId, medicationId, humanName, dose, form, dueAt, taken, site?: {last, next} }`

## Capsules — owner: Dev B
| Route | Auth | Input | Output |
|---|---|---|---|
| `POST /api/capsules` | member (owner-only for others' revoke) | `{personId, kind}` | `{capsule: {id, url, token, expiresAt}, qrPngDataUrl}` — expiry defaults: doctor_brief +24h · paramedic null · family +30d |
| `GET /api/capsules/:personId` | member | — | `{capsules: [{id, kind, url, expiresAt, revokedAt, views: [{viewedAt}]}]}` |
| `POST /api/capsules/:id/revoke` | member (owner for others') | — | `{revokedAt}` |
| `POST /api/capsules/:id/renew` | member | — | `{expiresAt}` |
| `GET /api/capsules/:id/wallet.pdf` | member | — | `application/pdf` wallet card (paramedic) |
| **`GET /c/[token]`** | **PUBLIC** | — | Server-rendered clinical page. Service-role fetch AFTER token+scope+expiry+revocation check; logs a `capsule_view`; only confirmed facts; 410 page (`expired`/`revoked`) otherwise; basic per-IP rate limit |

## System — owner: Dev B
| Route | Auth | Input | Output |
|---|---|---|---|
| `POST /api/cron/tick` | SYSTEM: header `x-cron-secret: CRON_SECRET` (pg_cron → here, every minute) | — | `{remindersSent, loopsFlippedOverdue, whatChangedSent}` — sends due SMS via Twilio (+email fallback), flips `open_loops` past `expected_date` to `overdue`, drains `notifications.pending` |
| `POST /api/webhooks/twilio-status` | SYSTEM: Twilio signature validation | Twilio form | 204 — updates `notifications.status` |
| `POST /api/voice/tool-call` | SYSTEM (STRETCH): header `x-agent-secret` | `{callerNumber, question}` | Same shape as `/api/ask` — caller-ID allowlist → personId; the ElevenLabs agent's tool endpoint |

## Non-negotiables (both devs)
1. No route ever returns another person's rows — RLS is the backstop, membership checks in handlers are the front line.
2. Service-role client only in server code paths marked SYSTEM/PUBLIC above; never in client bundles.
3. Every AI answer returns `citations`; UI renders them as source chips (SPEC-FINAL §5).
4. Unconfirmed facts (`confidence < 0.80` and unconfirmed) never cross into `/c/[token]` or notifications.
5. The error envelope is universal — no bare 500 texts.
