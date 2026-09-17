# SmartSailor — Competition Presentation Pack

Three files, all in this folder:

| File | What it is |
|---|---|
| `SmartSailor_Competition_Presentation.pptx` | 16 slides — **12 presented**, 4 appendix slides for Q&A |
| `SmartSailor_Judge_QA.pdf` | 6-page answer sheet, ~50 questions. Print one copy per member. |
| `PRESENTATION_README.md` | This file |

---

## ⚠️ THREE THINGS TO DO BEFORE YOU PRESENT

**1. Apply the three pending AI migrations.** In the Supabase SQL editor, in this order:
`20260930_ai_actions.sql` → `20261001_ai_actions_sprint4.sql` → `20261002_ai_campaigns_sprint5.sql`.
Until these are run on your live instance there is no `ai_actions` table, so **every AI *action* (join queue, book appointment, redeem reward, campaign) will fail.** AI *questions* still work.

**2. Verify one real Claude call, at least 48 hours out.** Set `ANTHROPIC_API_KEY` in `.env.local`, then ask one owner question and one customer question. No real Anthropic call has ever been made in this project — if the first one happens in front of judges, it is a coin flip.

**3. Replace `[ TEAM NAME ]` on slide 1.** It is deliberately a visible placeholder so you cannot miss it.

---

## Slide order

| # | Slide | Speaker | Time |
|---|---|---|---|
| 1 | Title | M1 | 0:15 |
| 2 | The Problem | M1 | 0:20 |
| 3 | **Our Solution — one platform, two workflows** ★ | M1 | 0:30 |
| 4 | Salon workflow diagram | M1 | shown during demo |
| 5 | Salon customer experience *(also the salon fallback)* | M1 | 0:10 |
| 6 | Beauty Parlour workflow diagram | M2 | shown during demo |
| 7 | Parlour customer experience *(also the parlour fallback)* | M2 | 0:10 |
| 8 | **AI — not a chatbot** ★ | M3 | 0:25 |
| 9 | **AI architecture — propose / confirm** ★ | M3 | 0:35 |
| 10 | Tech stack | M3 | 0:15 |
| 11 | Architecture & security | M3 | 0:20 |
| 12 | Closing — **leave this up for all 9 minutes of Q&A** | M1 | 0:20 |
| A1 | `appointments_no_overlap` — the actual SQL | — | appendix |
| A2 | RLS + how the AI's role is derived | — | appendix |
| A3 | What is verified, and what is not | — | appendix |
| A4 | Roadmap — implemented vs future | — | appendix |

★ = the three slides that win or lose this. Rehearse them most.

**The appendix slides are your highest-ROI preparation for a 9-minute Q&A.** Agree now that any member can say "slide A1" and whoever drives jumps there.

---

## The 6-minute run

```
0:00  0:35   M1   Hook + problem                    slides 1-2
0:35  1:05   M1   Solution — the two-workflow thesis  slide 3
1:05  2:35   M1   SALON LIVE DEMO                   slide 4, then browser
2:35  2:45   M1   hand over to M2
2:45  4:05   M2   PARLOUR LIVE DEMO                 slide 6, then browser
4:05  4:15   M2   hand over to M3
4:15  5:15   M3   AI capabilities + LIVE AI DEMO    slides 8-9
5:15  5:50   M3   Tech stack + security             slides 10-11
5:50  6:10   M1   Closing                           slide 12
6:10 15:00   ALL  Q&A                               slide 12 stays up
```

### Demo sequence, click by click

**SALON** — Tab 1 (salon customer) beside Tab 2 (salon owner)
1. `/explore` — map pins, each showing how many are in that queue right now
2. Click a pin → **দোকান দেখো** → `/explore/[shopId]`
3. Tap a service. If the StylePicker appears, pick a style
4. Tap **সিরিয়াল নাও** → confirm → position + ETA appear
5. Tab 2 `/dashboard` — the new serial is in a chair lane
6. Advance one serial, then glance back at Tab 1 — **it updated itself**

**PARLOUR** — Tab 3 (parlour customer) beside Tab 4 (parlour owner)
7. `/explore` — point out the badge says **"অ্যাপয়েন্টমেন্টে"**, not a queue count
8. Open a parlour → tap a 2–3 hour service
9. Pick a date → **pause on the slot grid** → pick a slot → confirm
10. Tab 4 `/dashboard` — the appointment is on today's schedule
11. **Speak** the exclusion-constraint point. Do **not** demo a live race.

**AI** — Tab 2
12. `/ai` → type **এই মাসে আমার ব্যবসার অবস্থা কেমন?**
13. Keep talking while it runs. Then point at the numbers and the tool list.
14. Switch to slide 9 and explain propose → confirm. **Do not demo a live AI action.**

**Do not show:** login, `/settings`, the admin panel, income figures, the code editor.

---

## Accounts and tabs

Four tabs, **all signed in before you walk in**. Never log in on stage.

| Tab | Account | Page |
|---|---|---|
| 1 | Salon customer (preference `SALON`) | `/explore` |
| 2 | Salon owner | `/dashboard` → later `/ai` |
| 3 | Parlour customer (preference `PARLOUR`) | `/explore` |
| 4 | Parlour owner | `/dashboard` |

Use **two windows side by side** for the salon segment. Seeing the customer's position change when the owner advances the queue does more than anything you can say about Realtime.

---

## Demo preparation checklist

### 48+ hours before
- [ ] Apply the three AI migrations (see top of this file)
- [ ] `ANTHROPIC_API_KEY` set; one real owner call and one real customer call verified
- [ ] Time a real AI response — **if it is over 8 seconds, plan to talk over it**
- [ ] Replace `[ TEAM NAME ]` on slide 1
- [ ] Record a **90-second screen capture** of the full flow → add as slide A0
- [ ] Capture 6 screenshots: salon queue board · customer serial with ETA · parlour slot grid · parlour schedule · AI answer with tool list · campaign proposal card

### Seed data
- [ ] Salon: open, accepting, **2–3 active chairs**, `chair_service_stats` rows with `can_perform = true`, 3–4 services, **lat/lng set**, logo uploaded
- [ ] Salon has **style options configured** — if not, cut that line from M1's script
- [ ] Salon queue pre-seeded with **2 waiting serials** (a queue of one looks like a bug)
- [ ] Parlour: **2 staff** with availability on the demo date, a 2–3 hour service, lat/lng set
- [ ] Parlour has **1 existing appointment** that day, so the slot grid visibly has a gap
- [ ] Salon owner has **≥ 3 months of completed serials with payments** — otherwise the AI will correctly say the sample is too thin, which is honest but not a demo
- [ ] A **preselected known-good slot** written down, in case the grid shifts

### 24 hours before
- [ ] **Three full run-throughs with a stopwatch.** Not two.
- [ ] One with Wi-Fi off — does the fallback actually work?
- [ ] One where M3 deliberately breaks the AI mid-sentence
- [ ] Each member answers their section of the Q&A PDF out loud, timed at 30 seconds
- [ ] Bookmark all four tabs; confirm all four sessions persist

### On the day
- [ ] Hit every route 2 minutes before (kills Vercel cold starts) — or run on `localhost`
- [ ] All four tabs open and signed in; deck open at slide 1
- [ ] **Increase browser zoom** so judges can read the queue board from the back
- [ ] Phone hotspot ready; laptop plugged in; notifications silenced; screensaver off
- [ ] Fallback video **downloaded locally**, not streamed

---

## Backup plan

**One failure must never cost more than 15 seconds.** Whoever drives cuts to the fallback without discussion. Agree the signal now — a hand on the laptop means "I'm cutting to screenshots."

| Failure | Say | Then |
|---|---|---|
| Internet dies | "নেটওয়ার্ক ছাড়া চলবে না — রেকর্ডিং দেখাই।" | Play slide A0 |
| AI slow (>8s) | Keep talking — explain tool-calling while it spins. **Never stand in silence.** | At 15s, cut to screenshot |
| AI fails | "AI লেয়ারটা নেটওয়ার্কের উপর নির্ভর করে — আর এটাই আমাদের ডিজাইনের একটা পয়েন্ট: AI বাদ দিলেও পুরো প্রোডাক্ট চলে।" | Screenshot + slide 9 |
| Login fails | "সেশন এক্সপায়ার হয়েছে" — do **not** retry | Screenshots |
| No slot free | "স্লট শেষ — এটাই আসল availability, ফিক্সড লিস্ট না।" | **Turn it into a feature**, use the preselected slot |
| Queue state changed | "লাইভ ডেটা, তাই বদলায়" | Carry on |
| Salon demo dies | — | Present slide 5; it is built as the fallback |
| Parlour demo dies | — | Present slide 7; same |

---

## Who answers what in Q&A

| Member | Owns |
|---|---|
| **M1** | Product, UX, salon, customer journey, business model |
| **M2** | Parlour, slot computation, staff availability, booking conflicts, appointment schema |
| **M3** | AI, security, RLS, architecture, tech stack, admin, scalability |

The domain owner answers first, in one or two sentences, and **may pass**: *"এটা আর্কিটেকচারের অংশ — [M3], তুমি বলো।"* A pass looks like a team. A guess looks like a guess. Nobody interrupts a teammate; corrections come after with *"একটা জিনিস যোগ করি —"*.

### Transition sentences — memorise exactly
- **M1 → M2:** *"এটা সেলুনের দিক। এখন পার্লার — একেবারে আলাদা ফ্লো। [name] দেখাবে।"*
- **M2 → M3:** *"দুইটা ফ্লো দেখলেন। এখন এর উপরে AI স্তরটা — [name]।"*
- **M3 → M1:** *"[name], শেষ করো।"*

---

## Technical facts to memorize

**The three sentences.**
1. সেলুন = লাইভ কিউ। পার্লার = অ্যাপয়েন্টমেন্ট। একটা কোডবেস, দুইটা নিয়ম — আর নিয়মটা `src/lib/business-model.ts`-এ একটা জায়গায় লেখা।
2. AI প্রস্তাব করে। মানুষ সম্মতি দেয়। ডেটাবেস সিদ্ধান্ত নেয়। ২৫টা টুলের একটাও লিখতে পারে না।
3. `EXCLUDE USING gist (staff_id WITH =, tstzrange(starts_at, ends_at) WITH &&)` — একই স্টাফের ওভারল্যাপিং অ্যাপয়েন্টমেন্ট ডেটাবেসে **ঢুকতেই পারে না**।

**The numbers — verified. Do not inflate any of them.**

| | |
|---|---|
| 67 | SQL migrations |
| 149 | tables and views |
| 1,159 | unit tests (48 files) |
| 14 | PostgreSQL concurrency harnesses, with genuinely parallel psql clients |
| 25 | AI tools — every one read-only |
| 4 | AI action types |
| 4 / 8 | `MAX_ITERATIONS` / `MAX_TOOL_CALLS` |
| 12 × 2000 | turns of history × characters per message |

**Four more that judges reach for.**
- **Role is derived, never claimed.** Nothing in the request says "I am an owner" — the server asks the database whether this user owns a shop. `user_metadata.role` is deliberately ignored because the user can write to it.
- **The confirm endpoint never calls the model.** `/api/ai/actions/confirm` re-validates everything with Claude out of the request entirely.
- **Segments are SQL, not opinion.** `LAPSED` means "no completed visit in the window" — a `WHERE` clause, not a prediction. There is no churn score in this product.
- **Honest limits:** no load testing · no AI rate limit or spend cap · not deployed to real shops · no customer-initiated cancellation · no payment gateway.

---

## How these files were built

Generated with `pptxgenjs` and `reportlab` from the verified codebase. The `.pptx` passed the full OOXML validator (schema, relationships, content types) and a geometry pass covering slide bounds, edge margins, text-box overlap, minimum font size and estimated text fit.

**Not verified:** the slides were never visually rendered — this sandbox has `soffice` but not the LibreOffice Impress filter, so it cannot convert a `.pptx` (or even a `.txt`) to PDF, and `poppler-utils` could not be installed. **Open the deck once in real PowerPoint before you rely on it.** Slide text is English so no Bangla font has to be present on the venue machine; all Bangla lives in the speaker notes, which is where you need it.
