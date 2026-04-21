const nodemailer = require("nodemailer");

// Create transporter once (port 587 / STARTTLS is less likely to be blocked by firewalls)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `"NEC Club Management" <${process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
    };

    if (options.attachments) {
      mailOptions.attachments = options.attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${options.email}: ${info.messageId}`);
  } catch (error) {
    console.error("❌ Email Sender Error:", error.message);
    throw error;
  }
};

module.exports = sendEmail;
