const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");

const config = require("./config");
require("./store"); // ensures the data dir/file exist before routes load

const { signupLimiter, verifyLimiter } = require("./rateLimit");
const signupRoutes = require("./routes/signup");
const verifyRoutes = require("./routes/verify");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.set("trust proxy", 1); // sits behind a reverse proxy in every real deployment

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'"],
        "style-src": ["'self'"],
      },
    },
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(
  session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // Set `secure: true` once you terminate TLS in front of this service
      // (recommended for anything beyond local testing).
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 60 * 1000,
    },
  })
);

app.get("/", (req, res) => res.redirect("/signup"));
app.get("/healthz", (req, res) => res.json({ ok: true }));

app.post("/signup", signupLimiter);
app.post("/verify", verifyLimiter);

app.use(signupRoutes);
app.use(verifyRoutes);

app.use((req, res) => {
  res.status(404).render("error", { message: "Page not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", { message: "Unexpected server error." });
});

app.listen(config.port, () => {
  console.log(`headscale-signup listening on :${config.port}`);
  console.log(`Headscale backend: ${config.headscale.url}`);
  console.log(`Allowed email domains: ${config.signup.allowedDomains.join(", ")}`);
});
