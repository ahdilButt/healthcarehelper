# Onboarding Screen — Revised Spec
*For: HealthcareHelper landing/onboarding screen. Written as a brief for the coding agent — copy, structure, and rationale now; animation instructions at the bottom for later implementation. Nothing here is locked — headline options are for you to pick or remix.*

## The core decision
Keep the screen emotionally dense, not feature-dense. The four feature clusters below carry all fifteen capabilities you listed, honestly mapped to what's actually being built (Stages 1–4 core; Guardian/Voice folded in as a soft "plus" line, not a headline promise). The existing "See the demo story" button becomes the full feature tour — comprehensiveness lives one tap away, not on screen one.

## Headline — pick one, or say which parts of each to combine
**Option 1 (names the labor):**
> H1: You're already carrying everything for them. Let this carry the details.
> Sub: Every letter, every medicine, every appointment — understood, tracked, and ready to share in one link. So nothing falls through the cracks, and you never have to explain it all again.

**Option 2 (practical, concrete):**
> H1: Stop carrying it all in your head.
> Sub: One place for their letters, medicines and appointments — explained in plain English, and ready to hand to any doctor, nurse or family member in seconds.

**Option 3 (warmest):**
> H1: Caring for someone is a full-time job. We're here to make it lighter.
> Sub: Snap a letter, ask a question, share what matters — everything you need to look after someone you love, without losing yourself in the paperwork.

## The four feature clusters (replaces the 3 cards)
**1. Understand everything, instantly**
Snap a letter or upload a record and get it back in plain English. Ask anything — "what did the cardiologist change?" — and get an answer pulled straight from their own documents, never guesswork.
*(covers: extraction, evidence in one place, AI Q&A, plain-English translation)*

**2. Never miss a beat, day to day**
A daily checklist of what's due, medicine reminders, and exactly where the last patch or gel went. When a letter changes a dose, everyone caring for them finds out.
*(covers: medication checklist, site-of-application guide, daily update, reminders, scheduled follow-ups)*

**3. Share it in one tap**
Generate a QR code or link that gives a doctor, a paramedic, or a family member everything they need to know — right now, without you repeating a word.
*(covers: QR/capsule sharing, handover, catching people up)*

**4. Care for more than one person, without losing track**
Keep separate, organised profiles for everyone you look after — a parent, a partner, a child — each with its own timeline, medicines and people who can help.
*(covers: multiple profiles)*

**Soft "plus" line below the cards** (text strip, not a 5th card — gestures at depth honestly, flags stretch features as additive rather than core):
> Plus: voice notes after every appointment, spoken answers you can just ask out loud, and reminders that reach the whole family — not just you.

**Footer trust line (keep, slightly warmed):**
> Private by default. Nothing leaves this app until you decide to share it.

**"See the demo story" button — recommendation:** make this the true home for the full fifteen-feature list, as a short guided walkthrough (3–5 screens). This is what resolves the tension between "poignant and short" and "shows everything" — both are true, they just live in different places.

---

## Animation & Motion Spec (instructions for the agent — not code, implement later)
*Note: "flashing" is softened to a refined staggered reveal with one pulse accent — a literal flash reads as cheap/AI-generated and would hurt the design score. This achieves the same "it's alive" feeling within our calm/warm aesthetic.*

On page load, sequence in this order, total runtime ~1.2–1.5s (fast — this is the first thing a stressed carer sees, it shouldn't make them wait):

1. Background fades in, 150ms.
2. Logo mark scales from 0.85→1.0 with one soft glow pulse (shadow expands and settles), 400ms, ease-out.
3. Wordmark fades in + slides up 8px, 250ms, starting 150ms after the logo (slight overlap, not sequential-blocking).
4. Headline fades in + slides up 12px, 300ms, starting 200ms after the wordmark.
5. Subheadline same treatment, 250ms, 100ms after the headline.
6. The four cards stagger in one at a time — fade + slide-up 10px, 200ms each, 80–100ms stagger between cards — so they read as a ripple, not a slow checklist.
7. Buttons fade + scale in last, 200ms; the primary "Get Started" button gets a subtle ease-out-back bounce, the secondary button doesn't (keeps one clear visual hierarchy).
8. Footer trust line fades in last and slowest, 400ms.
9. Optional, low-priority: a very slow (3s loop), low-amplitude glow pulse on the primary button's shadow to draw the eye — cut this first if it reads as busy in testing.
10. Required: respect `prefers-reduced-motion` — reduced-motion users get a simple fade only, no slide or scale. Flag this to the agent explicitly; it's both an accessibility requirement and a code-quality signal worth having in a healthcare app used by less tech-confident carers.
