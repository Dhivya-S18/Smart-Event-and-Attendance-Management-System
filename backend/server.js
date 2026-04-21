require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const seedClubs = require("./seed/seedClubs");

// Route imports
const authRoutes = require("./routes/authRoutes");
const clubRoutes = require("./routes/clubRoutes");
const eventRoutes = require("./routes/eventRoutes");
const adminRoutes = require("./routes/adminRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const feedbackFormRoutes = require("./routes/feedbackFormRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const userRoutes = require("./routes/userRoutes");
const reportRoutes = require("./routes/reportRoutes");
const associationRoutes = require("./routes/associationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const path = require("path");



// Connect to Database
connectDB().then(() => {
  // seedClubs(); // Disabled as per user request
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes); // Feedback Responses
app.use("/api/feedback-form", feedbackFormRoutes); // Feedback Forms
app.use("/api/certificate", certificateRoutes); // Certificates
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/associations", associationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/upload/profile", require("./routes/uploadRoutes"));

// Serve uploads folder static
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// PDF Generation Endpoints
const { generateCertificate, generateCircular } = require("./utils/generator");
const Event = require("./models/Event");
const { protect } = require("./middleware/authMiddleware");

app.get("/api/generate/certificate", protect, async (req, res) => {
  const { studentName, eventName, clubName, date } = req.query;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=certificate.pdf`);
  generateCertificate(studentName, eventName, clubName, date, res);
});

app.get("/api/generate/circular/:id", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("club").populate("club.coordinator");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=circular.pdf`);
    generateCircular(event, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const nodemailer = require("nodemailer");
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Verify email transporter on startup
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    try {
      await transporter.verify();
      console.log("✅ Email transporter verified successfully on startup");
    } catch (err) {
      console.error("❌ Email transporter verification failed on startup:", err.message);
    }
  } else {
    console.warn("⚠️ Email credentials not found in env file");
  }
});
