const REQUIRED_ENV_VARS = [
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
  "GEMINI_API_KEY",
  "CRON_SECRET",
];

// Validate required env vars on Vercel (both build and runtime — VERCEL=1
// is set in both phases). Skipped locally so `npm run build` works without
// production credentials. Set SKIP_ENV_VALIDATION=1 to bypass in any context.
const isVercel = process.env.VERCEL === "1";
const skipValidation = process.env.SKIP_ENV_VALIDATION === "1";

if (isVercel && !skipValidation) {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Set these in the Vercel project settings before deploying.`,
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

module.exports = nextConfig;
