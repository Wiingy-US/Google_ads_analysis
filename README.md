# Google Ads Insight Tool

A Next.js 14 application that pulls the last 30 days of Google Ads search-term, ad-group, and campaign performance data, classifies queries by intent and flags wasted-spend and low-CTR anomalies, then asks Gemini 1.5 Pro to generate prioritised optimisation recommendations. A daily Vercel cron triggers the pipeline automatically and emails the digest via Resend; a dashboard at `/` lets you trigger an analysis on demand and browse the results.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS for the dashboard
- `google-ads-api` for Google Ads queries (GAQL)
- `@google/generative-ai` for Gemini 1.5 Pro
- `resend` for transactional email
- Deployed on Vercel

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description | Required |
| --- | --- | --- |
| `GOOGLE_ADS_CLIENT_ID` | OAuth client ID from Google Cloud Console | Yes |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth client secret | Yes |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth refresh token for the ads account | Yes |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer token from the Google Ads API Center | Yes |
| `GOOGLE_ADS_CUSTOMER_ID` | 10-digit customer ID without dashes (e.g. `1234567890`) | Yes |
| `GEMINI_API_KEY` | API key from <https://aistudio.google.com> | Yes |
| `CRON_SECRET` | Random string Vercel attaches to cron requests as `Bearer …` | Yes |
| `RESEND_API_KEY` | API key from <https://resend.com> | For email digest |
| `DIGEST_EMAIL_TO` | Recipient address for the daily digest | For email digest |
| `DIGEST_EMAIL_FROM` | Sender address (defaults to Resend's sandbox `onboarding@resend.dev`) | Optional |

`next.config.js` validates the **required** variables on Vercel (build + runtime). Missing values fail the deploy with a clear message. Local builds skip this check; set `SKIP_ENV_VALIDATION=1` to bypass anywhere.

## Local development

```bash
npm install
cp .env.example .env.local
# fill in your credentials
npm run dev
```

Visit <http://localhost:3000>.

### Other scripts

```bash
npm run build         # production build
npm run smoke-test    # in-process pipeline test, no API calls
npm run lint          # next lint
```

## How the cron job works

`vercel.json` declares a single cron:

```json
{ "path": "/api/run-analysis", "schedule": "0 6 * * *" }
```

Every day at 06:00 UTC, Vercel sends `POST /api/run-analysis` with `Authorization: Bearer $CRON_SECRET`. The handler:

1. Verifies the secret (returns `401` if missing or wrong).
2. `fetchAllAdsData()` — queries Google Ads for the last 30 days of search terms, ad groups, and campaigns in parallel.
3. `analyseData()` — clusters search terms by intent (informational, transactional, navigational, branded, unknown) and detects two anomaly types (`high_impressions_low_ctr`, `high_spend_no_conversion`).
4. `generateInsights()` — sends a structured prompt to Gemini 1.5 Pro and gets back 8–12 prioritised suggestions plus a 2–3 sentence summary. Retries once if the model returns malformed JSON.
5. `sendDigestEmail()` — renders an HTML digest and ships it via Resend. A failure here is logged but does **not** fail the request.
6. Returns the full `InsightReport` as JSON.

## Triggering analysis manually

Two ways:

1. **Dashboard** — click **Analyse now** on the home page. This calls `GET /api/run-analysis` (no auth) and renders the suggestions inline.
2. **CLI** — same secret as the cron:

   ```bash
   curl -X POST https://your-app.vercel.app/api/run-analysis \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

## Health check

`GET /api/health` reports which env vars are present without exposing values:

```json
{
  "status": "ok",
  "timestamp": "2026-04-15T06:00:00.000Z",
  "env": {
    "googleAds": true,
    "gemini": true,
    "resend": true
  }
}
```

Use this after a deploy to confirm the runtime can see the secrets.

## Project layout

```
app/
  layout.tsx                 root layout (Tailwind)
  page.tsx                   dashboard (client component)
  api/
    ads-data/route.ts        GET — analysis result for the dashboard
    run-analysis/route.ts    POST (cron) + GET (manual) — full pipeline
    health/route.ts          GET — env presence check
lib/
  google-ads.ts              GAQL queries via google-ads-api
  analysis.ts                intent clustering + anomaly detection
  gemini.ts                  Gemini prompt + parsing
  email.ts                   HTML digest via Resend
  types.ts                   shared TypeScript types
scripts/
  smoke-test.ts              in-process pipeline test
vercel.json                  cron schedule
```
