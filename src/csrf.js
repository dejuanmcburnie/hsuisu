const crypto = require("crypto");

// Minimal session-bound CSRF token (double-submit via hidden form field).
// Good enough for a single small form flow; swap for a library if this
// service grows more surface area.

function ensureToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  return req.session.csrfToken;
}

function verify(req, res, next) {
  const submitted = req.body && req.body._csrf;
  if (!submitted || submitted !== req.session.csrfToken) {
    return res.status(403).render("error", {
      message: "Your session expired or this form was already submitted. Please start again.",
    });
  }
  next();
}

module.exports = { ensureToken, verify };
