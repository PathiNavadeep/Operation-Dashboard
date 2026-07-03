# OPS/25 — The Operations Dashboard

A production-styled operations dashboard for a Founder's Office: 25 live data sources,
a cache-first architecture, KPI/chart/table/alert widgets, an SOP trigger-rule engine,
and an SLA-clocked Action Queue — built exactly to the "Every widget must answer one of
three questions" brief.

**This build is fully static** (plain HTML/CSS/JS, zero dependencies, zero build step) so
you can open it immediately and see the whole system working end-to-end with realistic
simulated data. Wiring in your real API keys is a source-by-source, single-file change —
see **"Going live"** below.

## Run it

Just open `index.html` in a browser. That's it — no `npm install`, no server.

For a nicer local URL (recommended, avoids browser file:// quirks):

```bash
cd ops-dashboard
python3 -m http.server 8080
# then open http://localhost:8080
```

## What's inside

```
ops-dashboard/
├── index.html            All views: Overview, Level 1–3 sources, Trigger Rules,
│                          SOP Action Queue, Ship & Observe
├── css/styles.css         Full design system (dark + light themes)
├── js/data.js             The 25-source registry + TTL cache simulation
├── js/charts.js           Dependency-free canvas/SVG chart renderers
├── js/triggers.js         Trigger-rule engine + idempotent Action Queue
├── js/app.js               App shell: nav, search, filters, modal, refresh cycle
└── docs/API_REFERENCE.md   Real endpoint + auth + docs link for all 25 sources
```

## Features

- **25 live widgets** — every source from the brief (8 public, 10 key-based, 7 scrapers),
  each rendered as the chart type specified (KPI, line, bar, candlestick, heatmap, gauge,
  word cloud, table).
- **Cache-first, always** — every widget reads through a TTL cache (`js/data.js → Cache`).
  No widget ever "calls an API" directly, mirroring the brief's hard rule. Cards show a
  live "Updated Xs ago" timestamp and a freshness pulse dot.
- **Trigger-rule engine** — each source's threshold rule fires **idempotently**: one breach
  creates exactly one open Action Queue card, never a duplicate, until it's resolved.
- **SOP Action Queue** — sorted by SLA remaining, color-coded (green → amber → red →
  breached), with a live countdown and a one-click "Mark done."
- **RBAC demo** — the Founder/Analyst toggle on the Overview page hides a treasury-tier
  widget from the Analyst role, demonstrating server-side-style authorization (simulated
  client-side here; see "Going live" for the real pattern).
- **Search & filter** — filter by widget kind (KPI/Chart/Table/Alert) or free-text search
  across source name, SOP, trigger, and assignee.
- **Ship & Observe panel** — a CI pipeline strip, health checks, a live (simulated) log
  stream, and deploy target info — the Level 4 "ship it" checklist made visible.
- **Dark / light themes**, fully responsive, reduced-motion aware, keyboard-focusable.

## Going live: swapping in the real 25 APIs

The whole point of the cache-first architecture is that this is a **single-file change per
source**. Everything downstream (widgets, trigger rules, the Action Queue) already reads
through `Cache.get(src)` — it doesn't care where the data came from.

1. **Stand up a tiny backend** (Node/Express, per the brief's Level 2). For each source,
   write one route that calls the real endpoint (see `docs/API_REFERENCE.md`), and put any
   key in `.env` — never in git.
2. **Replace `Cache.generate(src)`** in `js/data.js`: instead of returning mock data, `await
   fetch('/api/widgets/'+src.id)` against your new backend and shape the JSON to match what
   each renderer expects (see the shapes already used per `src.type` in `js/data.js`).
3. **Keep the TTLs** — they're already tuned to each provider's real rate limit (e.g. Alpha
   Vantage's 25/day → a multi-hour TTL) so you never hit a 429 on page load.
4. **Move the trigger thresholds** from `js/triggers.js`'s illustrative breach logic to real
   numeric comparisons against the live values (the brief's `metric › comparator › threshold`
   table is already modeled 1:1 in `SOURCES[i].sop / trigger / assignee / sla`).
5. **Add real auth** — drop in Better Auth / Auth.js (both free, self-hosted) for
   founder/analyst roles, and enforce the RBAC check server-side, not just in the UI toggle
   this demo uses.
6. **Schedule refreshes** with GitHub Actions cron or `node-cron`, matching each source's
   rate limit and (for scrapers) `robots.txt` crawl-delay.
7. **Deploy** to Render/Railway/Vercel with the keys as host-level environment variables,
   add a `/health` route, and wire basic logging — the "Ship & Observe" tab in this UI is
   the target state to build toward.

See `docs/API_REFERENCE.md` for the exact endpoint, auth header, rate limit, and docs link
for every one of the 25 sources.

## Design notes

Palette and type are deliberately "instrument panel," not generic SaaS: deep graphite base,
amber for "act now" (alerts, triggers, the SOP Action Queue), cyan for "live data" (cache,
freshness), violet for structure (navigation, architecture). Space Grotesk carries headings,
IBM Plex Mono carries every number, timestamp, and identifier — so at a glance you can tell
"this is a live reading" from "this is a label."
