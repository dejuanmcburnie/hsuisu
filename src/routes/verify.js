const express = require("express");
const config = require("../config");
const otp = require("../otp");
const csrf = require("../csrf");
const store = require("../store");
const headscale = require("../headscaleClient");

const router = express.Router();

router.get("/verify", (req, res) => {
  if (!req.session.pendingEmail) {
    return res.redirect("/signup");
  }
  res.render("verify", {
    csrfToken: csrf.ensureToken(req),
    email: req.session.pendingEmail,
    error: req.session.flashError || null,
  });
  delete req.session.flashError;
});

router.post("/verify", csrf.verify, async (req, res) => {
  const email = req.session.pendingEmail;
  if (!email) {
    return res.redirect("/signup");
  }

  const submitted = String(req.body.code || "").trim();
  const result = otp.verifyOtp(email, submitted);

  if (!result.ok) {
    const messages = {
      none: "No code found. Request a new one.",
      expired: "That code expired. Request a new one.",
      locked: "Too many incorrect attempts. Request a new code.",
      mismatch: "Incorrect code. Try again.",
    };
    req.session.flashError = messages[result.reason] || "Verification failed.";
    if (result.reason === "none" || result.reason === "expired" || result.reason === "locked") {
      delete req.session.pendingEmail;
      return res.redirect("/signup");
    }
    return res.redirect("/verify");
  }

  try {
    const username = headscale.usernameFromEmail(email);
    const user = await headscale.getOrCreateUser(username);
    const preAuthKey = await headscale.createPreAuthKey(user.id);

    store.insertEnrollment({
      email,
      headscale_user_id: String(user.id),
      headscale_username: user.name,
      preauthkey_id: preAuthKey.id ? String(preAuthKey.id) : null,
      key_expires_at: preAuthKey.expiration,
      created_at: new Date().toISOString(),
    });

    delete req.session.pendingEmail;

    res.render("success", {
      loginServer: config.headscale.loginServer,
      authKey: preAuthKey.key,
      expiration: preAuthKey.expiration,
      adminUiUrl: config.adminUiUrl,
    });
  } catch (err) {
    req.log?.error?.(err);
    res.status(502).render("error", {
      message:
        "Your code was correct, but we couldn't reach Headscale to issue a device key. " +
        "Contact your administrator; nothing was enrolled.",
    });
  }
});

module.exports = router;
