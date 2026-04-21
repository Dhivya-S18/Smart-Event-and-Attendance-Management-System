const Event = require("../models/Event");
const FeedbackResponse = require("../models/FeedbackResponse");
const Certificate = require("../models/Certificate");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Generates and emails certificates for a single event (runs in background)
const autoCertificateGeneration = async (event) => {
  try {
    const fullEvent = await Event.findById(event._id).populate("clubId");
    if (!fullEvent) return;

    const feedbackResponses = await FeedbackResponse.find({ eventId: event._id });
    if (feedbackResponses.length === 0) {
      console.log(`[AutoCert] No feedback responses for "${fullEvent.title}", skipping.`);
      await Event.findByIdAndUpdate(event._id, { certificatesSent: true });
      return;
    }

    // Setup email
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const certsDir = path.join(__dirname, "../uploads/certificates");
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }

    const clubName = fullEvent.clubId?.clubName || "the Organizing Club";
    let sentCount = 0;

    for (const response of feedbackResponses) {
      try {
        // Skip if already sent
        const existing = await Certificate.findOne({ eventId: event._id, email: response.email });
        if (existing) continue;

        // Generate PDF
        const safeRegNo = (response.registerNumber || "student").replace(/[^a-zA-Z0-9]/g, "_");
        const pdfPath = path.join(certsDir, `${event._id}_${safeRegNo}.pdf`);
        const doc = new PDFDocument({ layout: "landscape", size: "A4" });
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        const W = doc.page.width;
        const H = doc.page.height;

        doc.rect(0, 0, W, H).fill("#fafafa");
        doc.rect(20, 20, W - 40, H - 40).lineWidth(4).stroke("#6366f1");

        doc.moveDown(1);
        doc.fontSize(36).fillColor("#1e1b4b").font("Helvetica-Bold")
          .text("Certificate of Participation", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor("#6b7280").font("Helvetica")
          .text("National Engineering College — Club Event Management System", { align: "center" });
        doc.moveDown(1.5);
        doc.fontSize(16).fillColor("#374151").font("Helvetica")
          .text("This is to certify that", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(32).fillColor("#4f46e5").font("Helvetica-Bold")
          .text(response.studentName, { align: "center" });
        doc.moveDown(0.3);
        doc.fontSize(13).fillColor("#6b7280").font("Helvetica")
          .text(`[ ${response.registerNumber} · ${response.department} ]`, { align: "center" });
        doc.moveDown(1);
        doc.fontSize(16).fillColor("#374151").font("Helvetica")
          .text("has successfully participated in", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(26).fillColor("#1e1b4b").font("Helvetica-Bold")
          .text(fullEvent.title, { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor("#6b7280").font("Helvetica")
          .text(`Organized by ${clubName}`, { align: "center" });
        doc.moveDown(1.5);
        doc.fontSize(12).fillColor("#9ca3af")
          .text(`Date: ${new Date(fullEvent.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, { align: "center" });

        doc.end();
        await new Promise((resolve, reject) => {
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });

        // Send email
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          await transporter.sendMail({
            from: `"NEC Events" <${process.env.EMAIL_USER}>`,
            to: response.email,
            subject: `🎓 Certificate of Participation — ${fullEvent.title}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#4f46e5;">Congratulations, ${response.studentName}! 🎉</h2>
                <p>Thank you for participating in <strong>${fullEvent.title}</strong> and submitting your feedback.</p>
                <p>Please find your <strong>Certificate of Participation</strong> attached to this email.</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;">
                <p style="color:#6b7280;font-size:0.85rem;">Organized by ${clubName} · National Engineering College</p>
              </div>
            `,
            attachments: [{
              filename: `Certificate_${fullEvent.title.replace(/\s+/g, "_")}_${response.registerNumber}.pdf`,
              path: pdfPath,
            }],
          });
        }

        // Record in DB
        await Certificate.create({
          eventId: event._id,
          studentId: response.studentId || null,
          studentName: response.studentName,
          email: response.email,
          certificateUrl: `/uploads/certificates/${event._id}_${safeRegNo}.pdf`,
        });

        sentCount++;
      } catch (innerErr) {
        console.error(`[AutoCert] Error for ${response.email}:`, innerErr.message);
      }
    }

    // Mark event as certificates sent
    await Event.findByIdAndUpdate(event._id, { certificatesSent: true });
    console.log(`[AutoCert] ✅ "${fullEvent.title}" — ${sentCount} certificates sent.`);
  } catch (error) {
    console.error(`[AutoCert] Failed for event ${event._id}:`, error.message);
  }
};

const autoUpdateEventStatus = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find events that are about to transition to completed
    const eventsToComplete = await Event.find({
      status: "published",
      date: { $lt: today }
    });

    if (eventsToComplete.length > 0) {
      // Update all to completed
      await Event.updateMany(
        { status: "published", date: { $lt: today } },
        { status: "completed" }
      );

      // For events with feedback enabled and certificates not yet sent,
      // trigger auto certificate generation in the background (non-blocking)
      for (const event of eventsToComplete) {
        if (event.feedbackEnabled && !event.certificatesSent) {
          console.log(`[AutoCert] Triggering certificate generation for "${event.title}"...`);
          // Fire and forget — don't await, don't block the request
          autoCertificateGeneration(event).catch(err =>
            console.error(`[AutoCert] Background error:`, err.message)
          );
        }
      }
    }

    next();
  } catch (error) {
    console.error("Auto status update failed:", error);
    next(); // Continue anyway to not block requests
  }
};

module.exports = { autoUpdateEventStatus };
