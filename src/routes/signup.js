const express = require("express");
const config = require("../config");
const otp = require("../otp");
const mailer = require("../mailer");
const csrf = require("../csrf");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function domainAllowed(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain && config.signup.allowedDomains.includes(domain);
}

router.get("/signup", (req, res) => {
  res.render("signup", {
    csrfToken: csrf.ensureToken(req),
    error: req.session.flashError || null,
  });
  delete req.session.flashError;
});

router.post("/signup", csrf.verify, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    req.session.flashError = "Enter a valid email address.";
    return res.redirect("/signup");
  }

  if (!domainAllowed(email)) {
    req.session.flashError =
      "That email domain isn't allowed to self-enroll. Contact your administrator.";
    return res.redirect("/signup");
  }

  const cooldown = config.signup.otpResendCooldownSeconds;
  if (otp.secondsSinceLastOtp(email) < cooldown) {
    req.session.flashError = `A code was already sent recently. Wait a bit before requesting another.`;
    req.session.pendingEmail = email;
    return res.redirect("/verify");
  }

  const { code } = otp.createOtp(email);

  try {
    await mailer.sendOtpEmail(email, code);
  } catch (err) {
    req.log?.error?.(err);
    req.session.flashError = "Could not send the verification email. Try again shortly.";
    return res.redirect("/signup");
  }

  req.session.pendingEmail = email;
  res.redirect("/verify");
});

module.exports = router;
