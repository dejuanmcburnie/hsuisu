const crypto = require("crypto");
const store = require("./store");
const config = require("./config");

function generateCode() {
  // 6-digit numeric code, zero-padded.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashCode(code, salt) {
  return crypto.scryptSync(code, salt, 64).toString("hex");
}

function createOtp(email) {
  const code = generateCode();
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashCode(code, salt);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.signup.otpTtlMinutes * 60_000);

  store.insertOtp({
    email,
    code_hash: hash,
    salt,
    attempts: 0,
    used: false,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  return { code, expiresAt };
}

function secondsSinceLastOtp(email) {
  const last = store.lastOtpForEmail(email);
  if (!last) return Infinity;
  return (Date.now() - new Date(last.created_at).getTime()) / 1000;
}

/**
 * Verifies a submitted code against the most recent, unused, unexpired OTP for the email.
 * Returns { ok: true } on success, or { ok: false, reason } on failure.
 * reason is one of: "none", "expired", "locked", "mismatch"
 */
function verifyOtp(email, submittedCode) {
  const row = store.lastOtpForEmail(email);
  if (!row || row.used) return { ok: false, reason: "none" };

  if (row.attempts >= config.signup.otpMaxAttempts) {
    return { ok: false, reason: "locked" };
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const candidateHash = hashCode(submittedCode, row.salt);
  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(candidateHash, "hex");
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    store.updateOtp(row.id, { attempts: row.attempts + 1 });
    return { ok: false, reason: "mismatch" };
  }

  store.updateOtp(row.id, { used: true });
  return { ok: true };
}

module.exports = { createOtp, verifyOtp, secondsSinceLastOtp };
