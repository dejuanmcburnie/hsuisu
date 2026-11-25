const rateLimit = require("express-rate-limit");

// Per-IP limits. These guard against bulk abuse; the per-email cooldown in
// otp.js guards against spamming a single inbox.
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many signup attempts from this address. Try again later.",
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many verification attempts from this address. Try again later.",
});

module.exports = { signupLimiter, verifyLimiter };
