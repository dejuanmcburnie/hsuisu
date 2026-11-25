const nodemailer = require("nodemailer");
const config = require("./config");

const transport = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
});

async function sendOtpEmail(to, code) {
  const ttl = config.signup.otpTtlMinutes;
  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject: "Your device enrollment code",
    text: `Your verification code is ${code}. It expires in ${ttl} minutes. If you did not request this, ignore this email.`,
    html: `
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>It expires in ${ttl} minutes. If you did not request this, ignore this email.</p>
    `,
  });
}

module.exports = { sendOtpEmail };
