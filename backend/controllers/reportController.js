const Report = require("../models/Report");
const Event = require("../models/Event");
const FeedbackResponse = require("../models/FeedbackResponse");
const PDFDocument = require("pdfkit");
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle } = require("docx");
const fs = require("fs");
const path = require("path");
const https = require("https");

// NEC Logo URL - we'll try to use a local one if available, else download or use placeholder
const LOGO_URL = "https://www.nec.edu.in/wp-content/uploads/2019/08/logo.png";
const LOGO_PATH = path.join(__dirname, "../uploads/nec_logo.png");

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
                return resolve(false); // Silent fail
            }

            const writer = fs.createWriteStream(dest);
            
            writer.on('error', (err) => {
                writer.close();
                if (fs.existsSync(dest)) fs.unlinkSync(dest);
                resolve(false);
            });

            response.on('error', (err) => {
                writer.close();
                if (fs.existsSync(dest)) fs.unlinkSync(dest);
                resolve(false);
            });

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


const getReport = async (req, res) => {
    try {
        const { eventId } = req.params;
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: "Event not found" });

        if (event.status !== "completed") {
            return res.status(403).json({ message: "Reports can only be managed for completed events." });
        }

        const report = await Report.findOne({ eventId }).populate("eventId");
        if (!report) {
            return res.status(200).json({ 
                message: "No report found",
                eventDetails: {
                    title: event.title,
                    venue: event.venue,
                    date: event.date,
                    time: event.time,
                    description: event.description
                }
            });
        }
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createOrUpdateReport = async (req, res) => {
    try {
        const { eventId, description, rounds, winners, photos, posterUrl, staffCoordinator, hod, dean, principal } = req.body;
        
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: "Event not found" });

        if (event.status !== "completed") {
            return res.status(403).json({ message: "Reports can only be created for completed events." });
        }

        let report = await Report.findOne({ eventId });
        
        // 📸 Map photos to storage format
        const formattedPhotos = (photos || []).map(p => 
            typeof p === 'string' ? { url: p, caption: "" } : p
        );

        if (report) {
            // Update - only update if field is provided (not undefined)
            if (description !== undefined) report.description = description;
            if (rounds !== undefined) report.rounds = rounds;
            if (winners !== undefined) report.winners = winners;
            if (photos !== undefined) report.photos = formattedPhotos;
            if (posterUrl !== undefined) report.posterUrl = posterUrl;
            if (staffCoordinator !== undefined) report.staffCoordinator = staffCoordinator;
            if (hod !== undefined) report.hod = hod;
            if (dean !== undefined) report.dean = dean;
            if (principal !== undefined) report.principal = principal;
            await report.save();

        } else {
            // Create
            report = await Report.create({
                eventId,
                description,
                rounds,
                winners,
                photos: formattedPhotos,
                posterUrl,
                staffCoordinator,
                hod,
                dean,
                principal,
                createdBy: req.user._id
            });
        }
        
        // --- 🏆 Trigger Winner Certificates ---
        if (report.winners && report.winners.length > 0) {
            const { generateAndSendWinnerCertificates } = require("./certificateController");
            // Run in background to not block response
            generateAndSendWinnerCertificates(eventId, report.winners);
        }
        
        res.status(201).json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteReport = async (req, res) => {
    try {
        const { id } = req.params;
        await Report.findByIdAndDelete(id);
        res.json({ message: "Report deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const generatePDF = async (req, res) => {
    console.log(`📜 Requesting PDF for Event ID: ${req.params.eventId}`);
    let doc = null;
    try {
        const { eventId } = req.params;
        const Registration = require("../models/Registration"); // Late require to avoid circular
        
        const report = await Report.findOne({ eventId }).populate({
            path: "eventId",
            populate: { path: "clubId" }
        });
        
        if (!report || !report.eventId) {
            console.error(`❌ Report or Event not found for Event ID: ${eventId}`);
            return res.status(404).json({ message: "Report or Event not found" });
        }

        console.log(`✅ Report found: ${report.eventId.title}`);
        
        // --- Fetch Actual Participants (from Registration) ---
        const participants = await Registration.find({ event: eventId });
        const feedbackResponses = await FeedbackResponse.find({ eventId });
        
        // Cross-reference attendance (anyone who gave feedback is considered attended)
        const attendedEmails = new Set(feedbackResponses.map(fr => fr.email.toLowerCase()));
        
        console.log(`👥 Found ${participants.length} total registrations, ${attendedEmails.size} confirmed attendance via feedback`);

        const safeTitle = (report.eventId.title || "Report").replace(/\s+/g, '_');
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=Report_${safeTitle}.pdf`);

        // --- 🏆 Trigger Winner Certificates (Ensures they are sent if not already) ---
        if (report.winners && report.winners.length > 0) {
            const { generateAndSendWinnerCertificates } = require("./certificateController");
            generateAndSendWinnerCertificates(eventId, report.winners);
        }

        doc = new PDFDocument({ margin: 50, size: "A4" });
        doc.pipe(res);

        // Store response locally for error handling
        let docErrorOccurred = false;

        // --- Header Section ---
        await downloadLogo();
        try {
            if (fs.existsSync(LOGO_PATH) && fs.statSync(LOGO_PATH).size > 100) {
                doc.image(LOGO_PATH, 50, 45, { width: 50 });
            }
        } catch (logoErr) { console.warn("Logo failed"); }

        doc.fillColor("#000").fontSize(14).font("Helvetica-Bold")
           .text("NATIONAL ENGINEERING COLLEGE, K.R.NAGAR, KOVILPATTI - 628 503", 110, 50, { align: "center", width: 430 });
        doc.fontSize(10).font("Helvetica")
           .text("(An Autonomous Institution – Affiliated to Anna University, Chennai)", 110, 70, { align: "center", width: 430 });

        doc.moveTo(50, 95).lineTo(550, 95).lineWidth(1).stroke();
        doc.moveDown(2);

        // --- Department & Association ---
        const deptName = (report.eventId.clubId?.department || "COMPUTER SCIENCE AND ENGINEERING").toUpperCase();
        doc.fontSize(12).font("Helvetica-Bold").text(`DEPARTMENT OF ${deptName}`, { align: "center" });
        
        const clubName = (report.eventId.clubId?.clubName || "Association").toUpperCase();
        doc.fontSize(12).font("Helvetica-Bold").text(clubName, { align: "center" });

        doc.moveDown();
        doc.fontSize(16).font("Helvetica-Bold").text("EVENT REPORT", { align: "center", underline: true });
        doc.moveDown();

        // --- Basic Details Table ---
        doc.fontSize(11).font("Helvetica-Bold");
        const detailsTop = doc.y;
        doc.rect(50, detailsTop, 500, 80).stroke();
        
        const drawRow = (y, label, value) => {
            doc.text(label, 60, y);
            doc.font("Helvetica").text(`:  ${value || "N/A"}`, 180, y);
            doc.font("Helvetica-Bold");
        };

        drawRow(detailsTop + 10, "Event Name", report.eventId.title);
        drawRow(detailsTop + 30, "Venue", report.eventId.venue);
        drawRow(detailsTop + 50, "Date", new Date(report.eventId.date).toLocaleDateString("en-IN"));
        drawRow(detailsTop + 70, "Time", `${report.eventId.time || "N/A"} to ${report.eventId.endTime || "N/A"}`);

        doc.y = detailsTop + 100;

        // --- Description ---
        doc.fontSize(12).font("Helvetica-Bold").text("1. Brief Description of the Event:");
        doc.fontSize(10).font("Helvetica").text(report.description || "No description provided", { align: "justify", lineGap: 2 });
        doc.moveDown();

        // --- Rounds ---
        if (report.rounds && report.rounds.length > 0) {
            doc.fontSize(12).font("Helvetica-Bold").text("2. Event Rounds / Activities:");
            report.rounds.forEach((r, idx) => {
                doc.fontSize(10).font("Helvetica-Bold").text(`${idx + 1}. ${r.roundName}:`, { continued: true });
                doc.font("Helvetica").text(` ${r.roundDescription || "-"}`);
            });
            doc.moveDown();
        }

        // --- Winners Table ---
        if (report.winners && report.winners.length > 0) {
            doc.fontSize(12).font("Helvetica-Bold").text("3. Winners List:");
            doc.moveDown(0.5);
            
            const wTop = doc.y;
            doc.rect(50, wTop, 500, 20).fill("#f0f0f0").stroke();
            doc.fillColor("#000").fontSize(10);
            doc.text("S.No", 60, wTop + 5);
            doc.text("Student Name", 100, wTop + 5);
            doc.text("Year - Dept", 300, wTop + 5);
            doc.text("Position", 480, wTop + 5);

            let rowY = wTop + 20;
            report.winners.forEach((w, i) => {
                doc.rect(50, rowY, 500, 20).stroke();
                doc.text((i + 1).toString(), 60, rowY + 5);
                doc.text(w.studentName || "-", 100, rowY + 5);
                const yearDept = `${w.year ? w.year + " Year" : ""} ${w.department || ""}`.trim() || "-";
                doc.text(yearDept, 300, rowY + 5);
                doc.text(w.ranking || "-", 480, rowY + 5);
                rowY += 20;
            });
            doc.y = rowY + 10;
        }

        // --- Assets (Poster) ---
        if (report.posterUrl) {
            doc.addPage();
            doc.fontSize(12).font("Helvetica-Bold").text("4. Event Poster:");
            doc.moveDown();
            try {
                const posterPath = path.join(__dirname, "..", report.posterUrl);
                if (fs.existsSync(posterPath)) {
                    doc.image(posterPath, { fit: [450, 600], align: "center" });
                }
            } catch (e) { doc.text("(Poster available in official repository)"); }
        }

        // --- Photos ---
        if (report.photos && report.photos.length > 0) {
            doc.addPage();
            doc.fontSize(14).font("Helvetica-Bold").text("Event Photos / Highlights", { align: "center" });
            doc.moveDown();
            
            for (const p of report.photos) {
                const url = typeof p === 'string' ? p : p.url;
                if (!url) continue;
                try {
                    const localPath = path.join(__dirname, "..", url);
                    if (fs.existsSync(localPath)) {
                        if (doc.y > 550) doc.addPage();
                        doc.image(localPath, { fit: [400, 250], align: "center" });
                        doc.moveDown(1);
                    }
                } catch (phErr) { console.warn("Photo failed"); }
            }
        }

        // --- Participants Table ---
        doc.addPage();
        doc.fontSize(12).font("Helvetica-Bold").text("5. Participants Registration & Attendance:");
        doc.moveDown(0.5);
        
        const pTop = doc.y;
        doc.rect(50, pTop, 500, 20).fill("#f0f0f0").stroke();
        doc.fillColor("#000").fontSize(9).font("Helvetica-Bold");
        doc.text("S.No", 60, pTop + 5);
        doc.text("Student Name", 100, pTop + 5);
        doc.text("Reg No", 240, pTop + 5);
        doc.text("Dept", 340, pTop + 5);
        doc.text("Status", 480, pTop + 5);

        let pY = pTop + 20;
        participants.forEach((p, i) => {
            if (pY > 700) {
                doc.addPage();
                pY = 50;
                // Redraw header if page breaks
                doc.rect(50, pY, 500, 20).fill("#f0f0f0").stroke();
                doc.fillColor("#000").text("S.No", 60, pY + 5);
                doc.text("Student Name", 100, pY + 5);
                pY += 20;
            }
            doc.rect(50, pY, 500, 18).stroke();
            doc.font("Helvetica").fontSize(8);
            doc.text((i + 1).toString(), 60, pY + 5);
            doc.text(p.studentName || "-", 100, pY + 5);
            doc.text(p.registerNumber || "-", 240, pY + 5);
            doc.text(p.department || "-", 340, pY + 5);
            
            const attended = attendedEmails.has(p.email?.toLowerCase());
            doc.fillColor(attended ? "#27ae60" : "#c0392b")
               .text(attended ? "[ Attended ]" : "[ Registered ]", 480, pY + 5);
            doc.fillColor("#000");
            pY += 18;
        });

        // --- Signature Section ---
        if (pY > 650) doc.addPage();
        const sigY = doc.page.height - 100;
        doc.fontSize(10).font("Helvetica-Bold");
        doc.text("Staff Coordinator", 50, sigY);
        doc.text("HOD", 200, sigY);
        doc.text("Dean (SA&IR)", 350, sigY);
        doc.text("Principal", 480, sigY);

        doc.end();
    } catch (error) {
        console.error("PDF Generate Error:", error);
        if (doc) doc.unpipe(res);
        require("fs").writeFileSync("debug_pdf_error.log", error.stack);
        
        if (!res.headersSent) {
            res.status(500).json({ message: error.message || "PDF generation failed" });
        } else {
            res.end();
        }
    }
};

const generateDOCX = async (req, res) => {
    console.log(`📝 Requesting DOCX for Event ID: ${req.params.eventId}`);
    try {
        const { eventId } = req.params;
        const report = await Report.findOne({ eventId }).populate({
            path: "eventId",
            populate: { path: "clubId" }
        });
        
        if (!report || !report.eventId) {
            console.error(`❌ Report or Event not found for DOCX, Event ID: ${eventId}`);
            return res.status(404).json({ message: "Report or Event not found" });
        }

        console.log(`✅ Report found: ${report.eventId.title}`);
        const Registration = require("../models/Registration");
        const participants = await Registration.find({ event: eventId });
        const feedbackResponses = await FeedbackResponse.find({ eventId });
        const attendedEmails = new Set(feedbackResponses.map(fr => fr.email?.toLowerCase()).filter(Boolean));
        console.log(`👥 Found ${participants.length} total registrations, ${attendedEmails.size} confirmed attendance via feedback`);

        const deptName = (report.eventId.clubId?.department || "COMPUTER SCIENCE AND ENGINEERING").toUpperCase();
        const clubName = (report.eventId.clubId?.clubName || "Association").toUpperCase();

        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: "NATIONAL ENGINEERING COLLEGE, K.R.NAGAR, KOVILPATTI - 628 503",
                                bold: true,
                                size: 28,
                            }),
                        ],
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: "(An Autonomous Institution – Affiliated to Anna University, Chennai)",
                                size: 20,
                            }),
                        ],
                    }),
                    new Paragraph({ text: "", spacing: { after: 200 } }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: `DEPARTMENT OF ${deptName}`,
                                bold: true,
                                size: 24,
                            }),
                        ],
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: clubName,
                                bold: true,
                                size: 24,
                            }),
                        ],
                        spacing: { before: 400, after: 400 }
                    }),
                    
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Event Name", bold: true })] })] }),
                                    new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: report.eventId.title })] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Venue", bold: true })] })] }),
                                    new TableCell({ children: [new Paragraph({ text: report.eventId.venue })] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date", bold: true })] })] }),
                                    new TableCell({ children: [new Paragraph({ text: new Date(report.eventId.date).toLocaleDateString("en-IN") })] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Time", bold: true })] })] }),
                                    new TableCell({ children: [new Paragraph({ text: `${report.eventId.time || "N/A"} to ${report.eventId.endTime || "N/A"}` })] }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({ text: "", spacing: { before: 400 } }),
                    new Paragraph({ children: [new TextRun({ text: "1. Brief Description of the Event: ", bold: true })] }),
                    new Paragraph({ text: report.description, alignment: AlignmentType.JUSTIFY }),
                    
                    new Paragraph({ text: "", spacing: { before: 200 } }),
                    new Paragraph({ children: [new TextRun({ text: "2. Event Rounds / Activities: ", bold: true })] }),
                    ...(report.rounds || []).flatMap(r => [
                        new Paragraph({ text: `• ${r.roundName}: ${r.roundDescription || "-"}`, alignment: AlignmentType.JUSTIFY })
                    ]),
                    
                    new Paragraph({ text: "", spacing: { before: 400 } }),
                    new Paragraph({ children: [new TextRun({ text: "3. Winners List: ", bold: true })] }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: "S.No", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Student Name", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Year - Dept", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Position", bold: true })] }),
                                ],
                            }),
                            ...(report.winners || []).map((w, i) => {
                                const yearDept = `${w.year ? w.year + " Year" : ""} ${w.department || ""}`.trim() || "-";
                                return new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph({ text: (i + 1).toString() })] }),
                                        new TableCell({ children: [new Paragraph({ text: w.studentName || "-" })] }),
                                        new TableCell({ children: [new Paragraph({ text: yearDept })] }),
                                        new TableCell({ children: [new Paragraph({ text: w.ranking || "-" })] }),
                                    ],
                                });
                            }),
                        ],
                    }),

                    new Paragraph({ text: "", spacing: { before: 400 } }),
                    new Paragraph({ children: [new TextRun({ text: "4. Event Highlights & Poster: ", bold: true })] }),
                    ...(report.photos || []).map(p => {
                        const url = typeof p === 'string' ? p : (p?.url || "N/A");
                        if (url.startsWith('/uploads')) {
                            const localPath = path.join(__dirname, "..", url);
                            try {
                                if (fs.existsSync(localPath)) {
                                    return new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [
                                            new ImageRun({
                                                data: fs.readFileSync(localPath),
                                                transformation: { width: 400, height: 250 }
                                            })
                                        ]
                                    });
                                }
                            } catch (e) { console.warn("DOCX Image skipped"); }
                        }
                        return new Paragraph({ text: `Photo Link: ${url}` });
                    }),

                    new Paragraph({ text: "", spacing: { before: 400 } }),
                    new Paragraph({ children: [new TextRun({ text: "5. Participants Registration & Attendance: ", bold: true })] }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: "S.No", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Name", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Reg No", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Dept", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Status", bold: true })] }),
                                ],
                            }),
                            ...(participants || []).map((p, i) => {
                                const attended = attendedEmails.has(p.email?.toLowerCase());
                                return new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph({ text: (i + 1).toString() })] }),
                                        new TableCell({ children: [new Paragraph({ text: p.studentName || "-" })] }),
                                        new TableCell({ children: [new Paragraph({ text: p.registerNumber || "-" })] }),
                                        new TableCell({ children: [new Paragraph({ text: p.department || "-" })] }),
                                        new TableCell({ children: [new Paragraph({ text: attended ? "Attended" : "Registered" })] }),
                                    ],
                                });
                            }),
                        ],
                    }),

                    new Paragraph({ text: "", spacing: { before: 800 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                            insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: "Staff Coordinator", bold: true, alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ text: "HOD", bold: true, alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Dean (SA&IR)", bold: true, alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Principal", bold: true, alignment: AlignmentType.CENTER })] }),
                                ],
                            }),
                        ],
                    }),
                ],
            }],
        });

        const buffer = await Packer.toBuffer(doc);
        const safeTitle = (report.eventId?.title || "Report").replace(/\s+/g, '_');
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename=Report_${safeTitle}.docx`);

        // --- 🏆 Trigger Winner Certificates (Ensures they are sent if not already) ---
        if (report.winners && report.winners.length > 0) {
            const { generateAndSendWinnerCertificates } = require("./certificateController");
            generateAndSendWinnerCertificates(eventId, report.winners);
        }

        res.send(buffer);
        console.log(`💾 DOCX generated and sent: Report_${safeTitle}.docx`);


    } catch (error) {
        console.error("DOCX Generate Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        } else {
            res.end();
        }
    }
};

module.exports = {
    getReport,
    createOrUpdateReport,
    deleteReport,
    generatePDF,
    generateDOCX
};
