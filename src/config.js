require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Environment variable ${name} must be an integer`);
  return n;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw.trim().toLowerCase() === "true";
}

const allowedDomains = required("ALLOWED_EMAIL_DOMAINS")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

if (allowedDomains.length === 0) {
  throw new Error("ALLOWED_EMAIL_DOMAINS must contain at least one domain");
}

module.exports = {
  port: int("PORT", 3000),
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${int("PORT", 3000)}`,

  headscale: {
    url: required("HEADSCALE_URL").replace(/\/+$/, ""),
    apiKey: required("HEADSCALE_API_KEY"),
    // Shown to the user in enrollment instructions; usually the same as HEADSCALE_URL,
    // but separate in case you terminate TLS / reverse-proxy clients to a different hostname.
    loginServer: (process.env.TAILSCALE_LOGIN_SERVER || required("HEADSCALE_URL")).replace(/\/+$/, ""),
  },

  signup: {
    allowedDomains,
    otpTtlMinutes: int("OTP_TTL_MINUTES", 10),
    otpResendCooldownSeconds: int("OTP_RESEND_COOLDOWN_SECONDS", 60),
    otpMaxAttempts: int("OTP_MAX_ATTEMPTS", 5),
    preAuthKeyTtlMinutes: int("PREAUTHKEY_TTL_MINUTES", 60),
    preAuthKeyEphemeral: bool("PREAUTHKEY_EPHEMERAL", false),
    preAuthKeyReusable: bool("PREAUTHKEY_REUSABLE", false),
  },

  smtp: {
    host: required("SMTP_HOST"),
    port: int("SMTP_PORT", 587),
    secure: bool("SMTP_SECURE", false),
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: required("SMTP_FROM"),
  },

  session: {
    secret: required("SESSION_SECRET"),
  },

  // Optional link shown on the success page, e.g. where an admin can manage devices
  // in gurucomputing/headscale-ui. Not used for anything functional here.
  adminUiUrl: process.env.ADMIN_UI_URL || null,

  storePath: process.env.STORE_PATH || "./data/signup.json",
};
