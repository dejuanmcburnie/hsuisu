// Tiny dependency-free, file-backed store for OTP codes and the enrollment
// audit log. Volume here is "a handful of signups", not a transactional
// workload, so a JSON file with synchronous writes is plenty -- and it avoids
// pulling in a native module (and its build toolchain) for a thin layer like
// this one.

const fs = require("fs");
const path = require("path");
const config = require("./config");

fs.mkdirSync(path.dirname(config.storePath), { recursive: true });

function load() {
  try {
    const raw = fs.readFileSync(config.storePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { otpCodes: [], enrollments: [], nextId: 1 };
  }
}

const state = load();

function persist() {
  fs.writeFileSync(config.storePath, JSON.stringify(state), "utf8");
}

function nextId() {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

function insertOtp(record) {
  const row = { id: nextId(), ...record };
  state.otpCodes.push(row);
  persist();
  return row;
}

function lastOtpForEmail(email) {
  const rows = state.otpCodes.filter((r) => r.email === email);
  return rows.length ? rows[rows.length - 1] : undefined;
}

function updateOtp(id, patch) {
  const row = state.otpCodes.find((r) => r.id === id);
  if (row) Object.assign(row, patch);
  persist();
}

function insertEnrollment(record) {
  const row = { id: nextId(), ...record };
  state.enrollments.push(row);
  persist();
  return row;
}

module.exports = { insertOtp, lastOtpForEmail, updateOtp, insertEnrollment };
