const FeedbackResponse = require("../models/FeedbackResponse");
const Event = require("../models/Event");
const Certificate = require("../models/Certificate");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const LOGO_URL = "https://www.nec.edu.in/wp-content/uploads/2019/08/logo.png";
const LOGO_PATH = path.join(__dirname, "../uploads/nec_logo.png");
const TEMPLATE_PATH = path.join(__dirname, "../uploads/certificate_template.png");
const https = require("https");
const http = require("http");

// Helper to download logo with redirect handling
const downloadLogo = async (url = LOGO_URL, dest = LOGO_PATH) => {
    // Priority: If custom logo exists, use it and skip download
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100) return true;
    
    return new Promise((resolve, reject) => {

        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirect
                return downloadLogo(response.headers.location, dest).then(resolve).catch(reject);
            }
            
            if (response.statusCode !== 200) {
                return resolve(false); // Silent fail, use fallback text
            }

            const writer = fs.createWriteStream(dest);
            response.pipe(writer);
            writer.on('finish', () => {
                writer.close();
                resolve(true);
            });
        }).on('error', (err) => {
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            resolve(false);
        });
    });
};

/**
 * Generates a PDF certificate matching the NEC certificate template layout.
 */
const generateCertificatePDF = (pdfPath, { studentName, registerNumber, department, eventName, clubName, eventDate, type = "Participation" }) => {
  return new Promise(async (resolve, reject) => {
    try {
      await downloadLogo();
      const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 0 });
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      const W = doc.page.width; 
      const H = doc.page.height;

      // ... background code ...
      try {
        if (fs.existsSync(TEMPLATE_PATH) && fs.statSync(TEMPLATE_PATH).size > 100) {
          doc.image(TEMPLATE_PATH, 0, 0, { width: W, height: H });
        } else {
          doc.rect(0, 0, W, H).fill("#ffffff");
          // Fallback background text or border
        }
      } catch (imgErr) {
        console.warn(`⚠️ Template image error: ${imgErr.message}`);
        doc.rect(0, 0, W, H).fill("#ffffff");
      }

      // --- Logo ---
      try {
        if (fs.existsSync(LOGO_PATH) && fs.statSync(LOGO_PATH).size > 100) {
          doc.image(LOGO_PATH, 40, 40, { width: 60 });
        }
      } catch (logoErr) {
        console.warn(`⚠️ Logo image error: ${logoErr.message}`);
        // Fallback: draw a simple blue circle or just rely on the text header
      }


      // ============================================================
      // TEXT OVERLAY — matching the NEC certificate template layout
      // ============================================================

      // --- College Header ---
      doc.fontSize(22).fillColor("#1a1a6e").font("Helvetica-Bold")
        .text("NATIONAL ENGINEERING COLLEGE", 0, 75, { align: "center", width: W });

      doc.fontSize(9).fillColor("#444").font("Helvetica")
        .text("(An Autonomous Institution, Affiliated to Anna University, Chennai)", 0, 78, { align: "center", width: W });

      doc.fontSize(9).fillColor("#444").font("Helvetica")
        .text("K.R Nagar, Kovilpatti - 628503", 0, 92, { align: "center", width: W });

    // --- Get Rank Text ---
    let titleText = "CERTIFICATE OF PARTICIPATION";
    let bodyIntro = "has participated in the event";
    let rankDisplay = "";

    if (type && type.toLowerCase() !== "participation") {
      titleText = "CERTIFICATE OF EXCELLENCE";
      
      // Clean up Rank Text (e.g., "1st" -> "1st Place", "Winner" -> "Winner")
      let displayType = type.trim();
      if (!/winner/i.test(displayType) && !/place/i.test(displayType)) {
          // If it's a numeric rank (1st, 2nd, 3rd), use "Place" instead of "Winner"
          if (/^[123](st|nd|rd)$/i.test(displayType)) {
              displayType = `${displayType} Place`;
          } else {
              displayType = `${displayType} Winner`;
          }
      }
      
      bodyIntro = `has secured the ${displayType} position in the event`;
      rankDisplay = `[ ${displayType} ]`;

      // Template Has Fixed "PARTICIPATION" Watermark. 
      // We cover it with a solid excellence glow for winner certificates.
      doc.save();
      doc.rect((W - 550) / 2, 320, 550, 100).fillColor("#ffffff").opacity(1.0).fill();
      doc.fontSize(60).fillColor("#1a1a6e").opacity(0.1).font("Helvetica-Bold")
         .text("EXCELLENCE", (W - 500) / 2, 345, { width: 500, align: "center" });
      doc.restore();
    }

    // --- CERTIFICATE TITLE ---
    doc.fontSize(20).fillColor("#333").font("Helvetica-Bold")
      .text(titleText, 0, 135, {
        align: "center",
        width: W,
        characterSpacing: 3,
      });

    // Decorative line under the title
    const lineY = 158;
    const lineW = 300;
    doc.moveTo((W - lineW) / 2, lineY).lineTo((W + lineW) / 2, lineY)
      .lineWidth(1).stroke("#7c3aed");

    // --- "This is to certify that" ---
    doc.fontSize(14).fillColor("#333").font("Helvetica")
      .text("This is to certify that", 0, 185, { align: "center", width: W });

    // --- Student Name (prominent) ---
    doc.fontSize(28).fillColor("#1a1a1a").font("Helvetica-Bold")
      .text(studentName, 0, 215, { align: "center", width: W });

    // Underline under name
    const nameWidth = doc.widthOfString(studentName);
    const nameLineY = 250;
    doc.moveTo((W - nameWidth) / 2 - 10, nameLineY)
      .lineTo((W + nameWidth) / 2 + 10, nameLineY)
      .lineWidth(0.5).stroke("#666");

    // --- Main body text ---
    const formattedDate = new Date(eventDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const bodyY = 270;

    if (rankDisplay) {
      doc.fontSize(18).fillColor("#d97706").font("Helvetica-Bold") // Golden color for rank
        .text(rankDisplay, 0, bodyY, { align: "center", width: W });
      doc.fontSize(13).fillColor("#333").font("Helvetica")
        .text(bodyIntro, 0, bodyY + 25, { align: "center", width: W });
    } else {
      doc.fontSize(13).fillColor("#333").font("Helvetica")
        .text(bodyIntro, 0, bodyY, { align: "center", width: W });
    }

    doc.fontSize(15).fillColor("#1a1a6e").font("Helvetica-Bold")
      .text(eventName, 0, bodyY + 45, { align: "center", width: W });

    doc.fontSize(13).fillColor("#333").font("Helvetica")
      .text(`organized by ${clubName}`, 0, bodyY + 71, { align: "center", width: W });

    doc.fontSize(13).fillColor("#333").font("Helvetica")
      .text(`on ${formattedDate}.`, 0, bodyY + 91, { align: "center", width: W });

    // --- Register Number & Department ---
    doc.fontSize(10).fillColor("#666").font("Helvetica")
      .text(`[ Reg. No: ${registerNumber}  |  Dept: ${department} ]`, 0, bodyY + 115, { align: "center", width: W });

      // ============================================================
      // SIGNATURE SECTION — matching the template layout
      // ============================================================
      const sigY = H - 100;
      const sigLineY = sigY - 5;
      const sigLabelY = sigY + 2;
      const sigLineW = 100;

      // Positions for 4 signatures
      const sigPositions = [
        { x: 80, label: "STUDENT\nCOORDINATOR" },
        { x: 250, label: "STAFF\nCOORDINATOR" },
        { x: 480, label: `HOD/${department || "DEPT"}` },
        { x: 650, label: "PRINCIPAL" },
      ];

      sigPositions.forEach((sig) => {
        // Signature line
        doc.moveTo(sig.x, sigLineY).lineTo(sig.x + sigLineW, sigLineY)
          .lineWidth(0.5).stroke("#333");

        // Label
        doc.fontSize(8).fillColor("#333").font("Helvetica-Bold")
          .text(sig.label, sig.x, sigLabelY, { width: sigLineW, align: "center" });
      });

      doc.end();

      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    } catch (e) {
      reject(e);
    }
  });
};

const generateAndSendCertificates = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).populate("clubId");

    if (!event) return res.status(404).json({ message: "Event not found" });

    // Fetch students who submitted feedback
    const feedbackResponses = await FeedbackResponse.find({ eventId });

    if (feedbackResponses.length === 0) {
      return res.status(400).json({ message: "No feedback responses found for this event" });
    }

    // --- PART 1: Skip Winners --- 
    // If a student is a winner, they get a winner certificate specially, 
    // so we skip them here for participation certificates.
    const Report = require("../models/Report");
    const report = await Report.findOne({ eventId });
    const winnerEmails = report ? report.winners.map(w => w.email.toLowerCase()) : [];

    // Check email credentials
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        message: "Email credentials (EMAIL_USER, EMAIL_PASS) are not configured in .env file. Cannot send certificates.",
      });
    }

    // Configure email transporter for Gmail
    let transporter = null;
    let emailEnabled = false;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // Verify transporter connection
      try {
        await transporter.verify();
        emailEnabled = true;
        console.log("✅ Email transporter verified successfully");
      } catch (verifyErr) {
        console.error("❌ Email transporter verification failed:", verifyErr.message);
        // We will continue without email if verification fails
      }
    } else {
      console.warn("⚠️ Email credentials not configured. Certificates will be generated but not emailed.");
    }

    const certsDir = path.join(__dirname, "../uploads/certificates");
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }

    const clubName = event.clubId?.clubName || "the Organizing Club";
    let sentCount = 0;
    let skippedCount = 0;
    const errors = [];

    const { resend } = req.body;

    const Registration = require("../models/Registration");

    for (const response of feedbackResponses) {
      try {
        // Build targets array starting with the feedback submitter
        const targets = [{
           studentName: response.studentName,
           registerNumber: response.registerNumber,
           email: response.email,
           department: response.department,
           studentId: response.studentId || null
        }];

        // Check if there are team members registered under this email
        const reg = await Registration.findOne({ event: event._id, email: response.email });
        if (reg && reg.teamMembers && reg.teamMembers.length > 0) {
            for (const member of reg.teamMembers) {
                if (member.email && member.name) {
                    // Prevent duplicate processing
                    if (!targets.some(t => t.email.toLowerCase() === member.email.toLowerCase())) {
                        targets.push({
                            studentName: member.name,
                            registerNumber: member.registerNumber || "N/A",
                            email: member.email,
                            department: response.department, // Use leader's department
                            studentId: null
                        });
                    }
                }
            }
        }

        // Generate and send for all targets (leader + team members)
        for (const target of targets) {
          try {
            // Skip if this student is a winner (they receive winner certificate instead)
            if (winnerEmails.includes(target.email.toLowerCase())) {
              console.log(`\u23ed️ Skipping participation cert for winner: ${target.email}`);
              continue;
            }

            // Check if certificate already sent for this student+event (bypass if resending)
            if (!resend) {
              const existingCert = await Certificate.findOne({
                eventId: event._id,
                email: target.email,
              });
              if (existingCert) {
                skippedCount++;
                continue;
              }
            }

            // Generate certificate PDF using template
            const safeRegNo = (target.registerNumber || "student").replace(/[^a-zA-Z0-9]/g, "_");
            const pdfFileName = `${eventId}_${safeRegNo}.pdf`;
            const pdfPath = path.join(certsDir, pdfFileName);

            console.log(`\ud83d\udcdc Generating certificate for ${target.studentName} (${target.email})...`);

            await generateCertificatePDF(pdfPath, {
              studentName: target.studentName,
              registerNumber: target.registerNumber,
              department: target.department,
              eventName: event.title,
              clubName: clubName,
              eventDate: event.date,
            });

            console.log(`\ud83d\udcbe Certificate PDF saved: ${pdfPath}`);

            // Send email with certificate attached if enabled
            if (emailEnabled && transporter) {
              const maxRetries = 2;
              let attempt = 1;
              let mailSent = false;

              while (attempt <= maxRetries && !mailSent) {
                try {
                  console.log(`\ud83d\udce7 Attempt ${attempt}: Sending email to ${target.email}...`);
                  await transporter.sendMail({
                    from: `"NEC Events" <${process.env.EMAIL_USER}>`,
                    to: target.email,
                    subject: `\ud83c\udf93 Certificate of Participation \u2014 ${event.title}`,
                    html: `
                      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                        <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:20px;border-radius:10px 10px 0 0;">
                          <h2 style="color:#fff;margin:0;">\ud83c\udf93 Certificate of Participation</h2>
                        </div>
                        <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 10px 10px;">
                          <p>Dear <strong>${target.studentName}</strong>,</p>
                          <p>Congratulations! \ud83c\udf89 Thank you for participating in <strong>${event.title}</strong>.</p>
                          <p>Please find your <strong>Certificate of Participation</strong> attached to this email.</p>
                          <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;">
                          <p style="color:#6b7280;font-size:0.85rem;">
                            Organized by <strong>${clubName}</strong><br>
                            National Engineering College, Kovilpatti
                          </p>
                        </div>
                      </div>
                    `,
                    attachments: [
                      {
                        filename: `Certificate_${event.title.replace(/\s+/g, "_")}_${target.registerNumber}.pdf`,
                        path: pdfPath,
                      },
                    ],
                  });
                  console.log(`\u2705 Email sent successfully to ${target.email} (Attempt ${attempt})`);
                  mailSent = true;
                  sentCount++;
                } catch (mailErr) {
                  console.error(`\u274c Attempt ${attempt} failed for ${target.email}:`, mailErr.message);
                  if (attempt < maxRetries) {
                    console.log(`\u23f3 Retrying in 2 seconds...`);
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                  } else {
                    errors.push({ email: target.email, error: `Email failed after ${maxRetries} attempts: ${mailErr.message}` });
                  }
                  attempt++;
                }
              }
            } else {
              console.log(`\u23ed️ Skipping email for ${target.email} (Email service disabled or failed verification)`);
            }

            // Record certificate in DB (upsert if resending)
            await Certificate.findOneAndUpdate(
              { eventId: event._id, email: target.email },
              {
                studentId: target.studentId || null,
                studentName: target.studentName,
                certificateUrl: `/uploads/certificates/${pdfFileName}`,
              },
              { upsert: true, new: true }
            );

          } catch (targetErr) {
            console.error(`\u274c Certificate error for ${target.email}:`, targetErr.message);
            errors.push({ email: target.email, error: targetErr.message });
          }
        }
      } catch (innerErr) {
        console.error(`\u274c Registration lookup error for ${response.email}:`, innerErr.message);
        errors.push({ email: response.email, error: innerErr.message });
      }
    }

    const msg =
      `Certificates generated for ${feedbackResponses.length} student(s).` +
      (emailEnabled ? ` Emails sent: ${sentCount}.` : " Email delivery was skipped due to configuration/auth issues.") +
      (skippedCount > 0 ? ` ${skippedCount} already existed.` : "") +
      (errors.length > 0 ? ` ${errors.length} email(s) failed.` : "");

    // Mark event so auto-trigger doesn't re-fire
    await Event.findByIdAndUpdate(eventId, { certificatesSent: true });

    console.log(`📊 Certificate summary: sent=${sentCount}, skipped=${skippedCount}, failed=${errors.length}`);

    res.status(200).json({
      message: msg,
      sent: sentCount,
      skipped: skippedCount,
      failed: errors.length,
      errors: errors,
    });
  } catch (error) {
    console.error("Certificate generation error:", error);
    res.status(500).json({ message: error.message });
  }
};

const downloadCertificatesZip = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const certificates = await Certificate.find({ eventId });
    if (certificates.length === 0) {
      return res.status(400).json({ message: "No certificates generated for this event yet." });
    }

    const zip = new AdmZip();
    const certsDir = path.join(__dirname, "../uploads/certificates");

    let addedCount = 0;
    certificates.forEach((cert) => {
      const fileName = path.basename(cert.certificateUrl);
      const filePath = path.join(certsDir, fileName);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
        addedCount++;
      }
    });

    if (addedCount === 0) {
      return res.status(404).json({ message: "Certificate files not found on server." });
    }

    const zipFileName = `Certificates_${event.title.replace(/\s+/g, "_")}.zip`;
    const zipBuffer = zip.toBuffer();

    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", `attachment; filename=${zipFileName}`);
    res.send(zipBuffer);
  } catch (error) {
    console.error("ZIP download error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Automatically triggers winner certificate generation and emailing.
 */
const generateAndSendWinnerCertificates = async (eventId, winnersList) => {
  try {
    const event = await Event.findById(eventId).populate("clubId");
    if (!event) throw new Error("Event not found");

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("⚠️ Email credentials not configured. Skipping winner certificates.");
        return;
    }

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const certsDir = path.join(__dirname, "../uploads/certificates");
    if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

    const clubName = event.clubId?.clubName || "the Organizing Club";

    for (const winner of winnersList) {
      try {
        const winnerEmail = winner.email || (winner.registerNumber ? `${winner.registerNumber.toLowerCase().trim()}@nec.edu.in` : null);

        if (!winnerEmail) {
            console.warn(`⚠️ No email or register number for ${winner.studentName}. Skipping...`);
            continue;
        }

        // Prevent duplicate emails within a short timeframe (e.g., 15 mins)
        const existingCert = await Certificate.findOne({ 
            eventId: event._id, 
            email: winnerEmail,
            type: "Winner",
            sentAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
        });
        
        if (existingCert) {
            console.log(`⏩ Certificate already sent to ${winnerEmail} recently. Skipping...`);
            continue;
        }

        const rankVal = winner.ranking || "Winner"; 
        const isWinnerSubstr = rankVal.toLowerCase().includes("winner");
        const isPlaceSubstr = rankVal.toLowerCase().includes("place");
        let displayType = rankVal;
        
        if (!isWinnerSubstr && !isPlaceSubstr) {
            if (/^[123](st|nd|rd)$/i.test(rankVal)) {
                displayType = `${rankVal} Place`;
            } else {
                displayType = `${rankVal} Winner`;
            }
        }

        const pdfFileName = `Winner_${eventId}_${winnerEmail.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
        const pdfPath = path.join(certsDir, pdfFileName);

        console.log(`🏆 Generating winner certificate for ${winner.studentName} (${winner.ranking})...`);

        await generateCertificatePDF(pdfPath, {
          studentName: winner.studentName,
          registerNumber: winner.registerNumber || "WINNER", 
          department: winner.department || "N/A",
          eventName: event.title,
          clubName: clubName,
          eventDate: event.date,
          type: rankVal 
        });

        // Email logic
        await transporter.sendMail({
          from: `"NEC Events" <${process.env.EMAIL_USER}>`,
          to: winnerEmail,
          subject: `✨ Winner Certificate — ${event.title}`,
          html: `
            <div style="font-family:Arial;max-width:600px;margin:20px auto;padding:20px;border:1px solid #e5e7eb;border-radius:12px;">
              <h2 style="color:#1a1a6e;">🏆 Congratulations, Student!</h2>
              <p>We are thrilled to inform you that you secured the <strong>${displayType}</strong> position in <strong>${event.title}</strong>.</p>
              <p>Your <strong>Winner Certificate of Excellence</strong> is attached herewith.</p>
              <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
              <p style="font-size:0.8rem;color:#666;">Organized by ${clubName}<br>National Engineering College, Kovilpatti</p>
            </div>
          `,
          attachments: [{
            filename: `Winner_Certificate_${rankVal.replace(/\s+/g, "_")}_${event.title.replace(/\s+/g, "_")}.pdf`,
            path: pdfPath,
          }],
        });

        // Record in DB
        await Certificate.findOneAndUpdate(
          { eventId: event._id, email: winnerEmail },
          {
            studentName: winner.studentName,
            certificateUrl: `/uploads/certificates/${pdfFileName}`,
            type: "Winner"
          },
          { upsert: true }
        );
        console.log(`✅ Winner cert sent to ${winner.email}`);
      } catch (err) {
        console.error(`❌ Error sending winner cert to ${winner.email}:`, err.message);
      }
    }
  } catch (error) {
    console.error("❌ Winner Certificate master trigger failed:", error.message);
  }
};

module.exports = { 
    generateAndSendCertificates, 
    downloadCertificatesZip,
    generateAndSendWinnerCertificates 
};
