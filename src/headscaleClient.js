// Thin wrapper around the Headscale REST API (https://<headscale>/api/v1/...).
//
// NOTE: Headscale's API has changed shape across versions (pre-0.23 used the
// username as the "user" identifier in some calls; later versions use the
// numeric user ID consistently). This client always resolves a numeric user
// ID first via GET/POST /api/v1/user and then uses that ID everywhere else.
// If your server's /swagger page shows a different shape, this is the only
// file you should need to adjust.

const config = require("./config");

class HeadscaleApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "HeadscaleApiError";
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${config.headscale.url}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.headscale.apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    throw new HeadscaleApiError(`Headscale API ${path} returned ${res.status}`, res.status, body);
  }

  return body;
}

/**
 * Finds an existing headscale user by name, or creates one.
 * Returns { id, name }.
 */
async function getOrCreateUser(name) {
  const existing = await request(`/api/v1/user?name=${encodeURIComponent(name)}`);
  const match = (existing.users || []).find((u) => u.name === name);
  if (match) {
    return { id: match.id, name: match.name };
  }

  const created = await request(`/api/v1/user`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return { id: created.user.id, name: created.user.name };
}

/**
 * Issues a short-lived pre-auth key for the given headscale user ID.
 * Returns { key, expiration, id }.
 */
async function createPreAuthKey(userId) {
  const expiration = new Date(
    Date.now() + config.signup.preAuthKeyTtlMinutes * 60_000
  ).toISOString();

  const result = await request(`/api/v1/preauthkey`, {
    method: "POST",
    body: JSON.stringify({
      user: String(userId),
      reusable: config.signup.preAuthKeyReusable,
      ephemeral: config.signup.preAuthKeyEphemeral,
      expiration,
    }),
  });

  const preAuthKey = result.preAuthKey || result.preauthkey;
  if (!preAuthKey || !preAuthKey.key) {
    throw new HeadscaleApiError(
      "Unexpected response shape from /api/v1/preauthkey — check your Headscale version against /swagger",
      200,
      result
    );
  }

  return {
    key: preAuthKey.key,
    id: preAuthKey.id,
    expiration: preAuthKey.expiration || expiration,
  };
}

/** Turns an email into a username that satisfies headscale's naming rules. */
function usernameFromEmail(email) {
  const local = email.split("@")[0].toLowerCase();
  const sanitized = local.replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || `user-${Date.now()}`;
}

module.exports = { getOrCreateUser, createPreAuthKey, usernameFromEmail, HeadscaleApiError };
