# Handoff: Palaa (পালা) — Salon Serial Management System

## How to Implement with Claude Code

1. Unzip this folder and open it in VS Code (or place it inside your project repo, e.g. `design/`).
2. Open the terminal in VS Code and run `claude`.
3. Give Claude Code the prompt below (see "Suggested Prompts" at the end of this file).
4. Iterate feature-by-feature: queue engine first, then customer app, then shop dashboard.

## Overview
Palaa is a live queue ("serial") management system for barber shops / salons in Bangladesh. It eliminates in-shop waiting: customers see nearby shops with live queue lengths, book a serial online (optionally locking it with advance mobile-banking payment), and track a live countdown until their turn. Shop owners manage the live queue, mark jobs done, and get automatic income tracking, customer-load analytics, service/rate management, regular-customer reminders, and reviews.

Two user roles share ONE live queue state:
- **Customer** — mobile app (392px phone frame)
- **Shop owner (দোকানদার)** — web dashboard (sidebar + main panel)

When the shop owner taps "কাজ সম্পন্ন" (job done), the queue advances, income is added automatically, and every waiting customer's ETA re-calculates live.

## About the Design Files
The files in this bundle are **design references created in HTML** — an interactive prototype showing intended look and behavior, NOT production code to copy directly. The task is to **recreate this design in the target codebase's environment** (e.g. React/Next.js + a real backend with WebSocket/real-time sync, or React Native/Flutter for the customer app) using its established patterns. If no environment exists yet, choose an appropriate stack (suggestion: React web dashboard + React Native customer app, shared Node/Firebase backend with real-time queue updates, bKash/Nagad payment gateway).

`Palaa.dc.html` is a self-contained prototype: open it in a browser. It uses a custom lightweight component runtime (`support.js`); read the markup + the `class Component` script inside it for the full UI structure and logic. The prototype chrome (top dark bar with role/theme/countdown toggles) is **prototype-only tooling** — do not build it in the real product.

`Palaa Documentation.dc.html` (+ `doc-page.js`) is the full feature/functionality spec in Bangla — treat it as the product requirements document.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interactions are final design intent. Recreate pixel-perfectly. All demo data (names, amounts, charts) is mock.

## Language
UI copy is Bangla + English mix (Bangla primary). Currency: ৳ (BDT). Numerals: Latin digits in numeric/stat contexts (Space Grotesk), Bangla digits in some labels — follow the prototype copy exactly.

## Design Tokens

Two themes; **Warm is the default**. Both defined as CSS variables in the prototype.

### Warm theme (default)
- `--paper` #F1EDE4 (page background)
- `--card` #FFFDF8 (cards)
- `--soft` #F7F3EA (inset surfaces)
- `--ink` #1B1812 (text / dark surfaces)
- `--muted` #857E70 (secondary text)
- `--line` #E7E0D2 (borders)
- `--accent` #1C5D44 (primary green), `--accent-ink` #F4F1EA (text on accent)
- `--brass` #B5852F, `--brass-soft` #F3E7CC (ratings, "নিয়মিত" badge)
- `--live` #CF4E25, `--live-soft` #FBE4D8 (live/countdown/urgent)
- `--good` #2E7D5B, `--good-soft` #DCEFE4 (success, income)
- shadow: `24px 24px 60px rgba(40,32,15,.10)`

### Cool theme (alternative)
- paper #EEF1F6, card #FFFFFF, soft #F4F6FA, ink #14161C, muted #6A7280, line #E3E7EF, accent #3B3BDA (accent-ink #FFFFFF), brass #7C6CF0 / #E9E6FC, live #E0453B / #FBE2E0, good #1F9D6B / #DBF1E8

### Typography
- Body (Bangla): **Hind Siliguri** 400/500/600/700
- Display/headings: **Anek Bangla** 600/700/800
- Numbers/timers/money: **Space Grotesk** 500/600/700 (monospace feel)
- Sizes: page titles 25–27px (weight 700), card titles 15–16px, body 13–14px, secondary 11–12px, big countdown 42–46px, stat numbers 19–32px

### Shape & spacing
- Radii: phone frame 42px, large cards 20–26px, cards/rows 14–18px, buttons 11–16px, pills 20–30px
- Borders: 1px `--line` (1.5px on selected service cards)
- Card padding 14–24px; grid/flex gaps 8–18px

### Animations
- `pulse` (live dots): opacity 1→.35, scale 1→.82, 1.4s infinite
- `fadeUp` .3s on screen change; `pop` .3s on toasts/cards
- Countdown ring: `stroke-dashoffset` transition 1s linear; bar: `width` 1s linear

## Screens / Views

### Customer app (phone frame 392px, bottom nav: হোম / সিরিয়াল / প্রোফাইল)

**1. Home — nearby shops**
- Greeting + title "কাছের সেলুন", avatar chip; location row "◉ মিরপুর ১০, ঢাকা" + "পরিবর্তন" link
- If active booking: dark (`--ink`) banner card → serial #, ETA, pulsing live dot; tap → tracking screen
- Two stat chips: open shop count, minimum wait
- Shop list cards: 54px colored avatar with initial, name + optional "নিয়মিত" brass pill, ★ rating · distance · area, two pills: "চলছে N সিরিয়াল" and "~M মিন ওয়েট" (green `--good-soft` if ≤40min wait, else red `--live-soft`). Hover: lift -2px, accent border.

**2. Shop detail + booking**
- 118px accent gradient header with back button; 74px avatar overlapping -30px; name, ★ rating · area · distance
- Three stat tiles: current queue, estimated wait (live-colored), review count
- Service multi-select list: checkbox (24px, accent when selected), name, ~minutes, ৳rate; selected row gets accent border + 7% accent tint background
- Advance payment toggle card: switch + "অ্যাডভান্স পেমেন্ট দিয়ে সিরিয়াল লক করো" / "bKash/Nagad — সিরিয়াল কনফার্ম ও সিকিউর থাকবে"
- Sticky bottom bar: total minutes + total ৳ (auto-summed), CTA button — label "অ্যাডভান্স দিয়ে কনফার্ম" when toggle on, else "সিরিয়াল নাও"

**3. Live tracking**
- Header: shop name, back, pulsing "LIVE" tag
- Countdown card (dark `--ink`): two layout variants —
  - **Ring** (default): 210px SVG circle, stroke `--live` 14px, dashoffset animates; center shows remaining time big + unit; serial # pill below
  - **Bar**: big time left + serial # right, 12px progress bar
- "তোমার আগে যারা (N জন)" list: position #, name, services; row 1 = currently being served (live MM:SS, `--live-soft` bg); others show "শুরু হবে" cumulative ETA. Final row = "তুমি (You)" in solid accent.
- Button: "কাজ শেষ? রিভিউ দাও ★" → review screen

**4. Review**
- Shop avatar + "{{shop}} কেমন ছিল?"; 5 tappable stars (42px, brass when active, scale 1.15 on hover); rating label (খুব খারাপ→চমৎকার!); optional textarea; submit → toast "🙏 রিভিউয়ের জন্য ধন্যবাদ!"

**5. Profile**
- Dark card: avatar, name, phone, **Trust Score** (4.9, green) chip
- Green callout: "বিশ্বস্ত কাস্টমার…" trust explanation
- Stat tiles: মোট ভিজিট / নো-শো / নিয়মিত দোকান
- Serial history rows: shop avatar, service, date, ৳amount, ★given

### Shop dashboard (dark 236px sidebar + scrollable main)

Sidebar: shop identity, nav (লাইভ সিরিয়াল w/ live count badge, ইনকাম, অ্যানালিটিক্স, সার্ভিস ও রেট, নিয়মিত কাস্টমার, রিভিউ), pinned today-income card at bottom. Active item = solid accent.

**1. Live queue** (default)
- Title + "রিয়েল-টাইম আপডেট হচ্ছে" pulsing pill
- Grid 1.5fr/1fr: **Now-serving dark card** — customer name, services, ৳, countdown (128px ring OR bar variant, MM:SS), full-width green button "✓ কাজ সম্পন্ন — পরের জন"
- Right column: last-customer wait estimate; today summary (done / waiting / income)
- Waiting list rows: position, name + badges ("নিয়মিত" brass, "✓ অ্যাডভান্স পেইড" green), services, "শুরু হবে" cumulative time (live color), ৳
- Empty state: dashed card "কোনো অপেক্ষমাণ সিরিয়াল নেই 🎉"

**2. Income** — 3 stat cards (today dark w/ green number, month + ▲12%, year); 12-month bar chart (brass-soft bars, current month accent); per-service income progress bars

**3. Analytics** — KPIs (daily avg customers, peak time in live color, avg service time); hourly load bar chart with "পিক" label on max bar (accent intensity scale → live for peak); weekly load chart (Friday peak); insights list (3 bullets)

**4. Services & rates** — 2-col grid of service cards: emoji icon tile, name, ~minutes, ৳rate, "● চালু"; "+ নতুন সার্ভিস" button

**5. Regular customers** — rows: avatar, name, last visit, total visits; status pill "এই মাসে এসেছে" (green) / "আসেনি" (red); action button "🔔 রিমাইন্ডার দাও" (solid accent, becomes "✓ পাঠানো হয়েছে" ghost after click) or "মেসেজ পাঠাও" ghost

**6. Reviews** — dark summary card (4.8, stars, count) + star-distribution bars (82/13/4/1%); review cards (avatar, name, date, stars, Bangla text)

**Toast** — bottom-center dark pill, pop animation, auto-dismiss 2.4s.

## Interactions & Behavior
- **Booking flow**: select services → totals auto-sum → confirm → appended to end of shared queue as "তুমি (You)" → navigates to tracking → toast ("✅ অ্যাডভান্স পেইড — সিরিয়াল লক হলো" if advance, else "✅ সিরিয়াল কনফার্ম হলো")
- **Countdown engine**: 1-second tick decrements current job's remaining seconds; when it hits 0 the queue auto-advances (job's amount added to income). ETA for serial N = current remaining + Σ(service minutes of serials 2…N−1). Everything re-renders each tick.
- **Mark done**: removes head of queue, starts next timer, adds amount to daily/monthly/yearly income, increments done-count, toast "✓ কাজ সম্পন্ন — আয় যোগ হলো"
- **Reminder**: per-customer one-shot; button state persists (in-memory in prototype)
- Screen transitions: fadeUp .3s. Buttons: pointer cursor everywhere; shop cards lift on hover.

## State Management (real implementation)
- Shared real-time queue store (WebSocket / Firestore): `[{id, name, services[], estMinutes, amount, fixed, advancePaid}]` + `remainingSec` for head job
- Customer: activeBooking (max ONE per user — **enforce single active serial across all shops**; block booking elsewhere while one is active), selected services, advance toggle, rating
- Shop: income counters (day/month/year, auto-incremented on job completion), done count, reminders sent, services CRUD
- Trust score: derived from completed vs no-show serials

## Business Rules (see documentation file for full spec)
1. One active serial per customer, system-enforced (anti-fake-booking)
2. Advance payment (bKash/Nagad) locks/confirms the serial
3. Per-job time is set by the shop owner based on selected services (owner can adjust to their own pace)
4. Completing a job auto-adds its amount to income analytics
5. Trust score rises with completed services, falls with no-shows; shown to shop owners
6. Regular customers who haven't visited this month can be sent reminders
7. Service rates are public for transparency

## Assets
- Google Fonts only: Hind Siliguri, Anek Bangla, Space Grotesk (loaded via fonts.googleapis.com)
- No images — avatars are colored tiles with initials; icons are unicode glyphs/emoji
- Countdown ring: inline SVG circle with animated stroke-dashoffset

## Files
- `Palaa.dc.html` — the interactive prototype (both roles, both themes, both countdown layouts)
- `support.js` — prototype component runtime (required for the HTML to run; NOT part of the design)
- `Palaa Documentation.dc.html` + `doc-page.js` — full feature & functionality spec in Bangla (product requirements; includes future-feature backlog and changelog tables)

## Suggested Prompts for Claude Code

**Kickoff (paste this first):**

> Read `design_handoff_palaa/README.md` fully — it is the implementation spec for "Palaa", a salon queue management system. The HTML files are a design prototype, NOT production code. Set up a new full-stack project: React + Vite + Tailwind for the frontend (two apps in one codebase: a mobile-first customer app and a desktop shop-owner dashboard), Node.js + Express + Socket.IO for the real-time backend, and SQLite (via Prisma) for storage. Recreate the design pixel-faithfully using the design tokens in the README (Warm theme as default). Start with: (1) the data model and real-time queue engine with per-second countdown and ETA calculation, (2) the shop dashboard live queue screen with "mark done", (3) the customer booking + live tracking flow. Open `Palaa.dc.html` in a browser to reference the exact visuals.

**Follow-up prompts, one at a time:**

> Implement the shop dashboard remaining screens: Income (daily/monthly/yearly auto-tracking + charts), Analytics (hourly/weekly load), Services & Rates CRUD, Regular Customers with reminders, and Reviews — per the README.

> Implement the customer app remaining screens: profile with trust score and history, the review flow, and enforce the one-active-serial-per-customer rule server-side.

> Add the advance payment flow with a mocked bKash/Nagad gateway (interface it so a real gateway can be swapped in later).

**Tips:**
- Ask Claude Code to write tests for the ETA calculation (serial N wait = current remaining + sum of service minutes of serials 2…N−1).
- Keep the README open; tell Claude Code "check the README design tokens" whenever styling drifts.
- All Bangla UI strings are in the prototype HTML — Claude Code can extract them verbatim.
