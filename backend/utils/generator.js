const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const generateCertificate = (studentName, eventName, clubName, date, res) => {
  const doc = new PDFDocument({ layout: "landscape", size: "A4" });

  doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

  doc.fontSize(40).text("CERTIFICATE OF PARTICIPATION", { align: "center" }).moveDown();
  doc.fontSize(20).text("This is to certify that", { align: "center" }).moveDown(0.5);
  doc.fontSize(30).text(studentName, { align: "center", underline: true }).moveDown(0.5);
  doc.fontSize(20).text(`has successfully participated in the event`, { align: "center" }).moveDown(0.5);
  doc.fontSize(25).text(eventName, { align: "center" }).moveDown(0.5);
  doc.fontSize(20).text(`organized by ${clubName}`, { align: "center" }).moveDown();
  doc.fontSize(15).text(`Date: ${new Date(date).toDateString()}`, { align: "right" });

  doc.pipe(res);
  doc.end();
};

const generateCircular = (event, res) => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  // Draw Page Border
  doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20).stroke();

  // Institutional Header
  doc.rect(25, 25, doc.page.width - 50, 110).fill("#1e293b");
  doc.fillColor("white").fontSize(10).font("Helvetica-Bold").text("INSTITUTION OF EXCELLENCE", 0, 45, { align: "center" });
  doc.fontSize(22).text("COLLEGE OF ENGINEERING & TECHNOLOGY", 0, 65, { align: "center" });
  doc.fontSize(10).font("Helvetica").text("OFFICE OF THE STUDENT AFFAIRS & CLUBS", 0, 95, { align: "center" });

  doc.fillColor("black").moveDown(6);

  // Administrative Section
  doc.fontSize(9).font("Helvetica");
  doc.text(`REFERENCE ID: CET/ADMIN/EVENT/${new Date().getFullYear()}/${Math.floor(Math.random()*1000)}`, 50, doc.y);
  doc.text(`ISSUANCE DATE: ${new Date().toLocaleDateString().toUpperCase()}`, 50, doc.y, { align: "right" });
  doc.moveDown();

  // Official Seal / Title
  doc.fontSize(14).font("Helvetica-Bold").text("OFFICIAL NOTICE", { align: "center", underline: true }).moveDown(1.5);

  // Subject Heading
  doc.fontSize(12).font("Helvetica-Bold").text(`SUB: ANNOUNCEMENT AND INVITATION FOR "${event.title.toUpperCase()}"`, { align: "left" }).moveDown();

  // Formal Salutation/Body
  doc.fontSize(11).font("Helvetica").text("Dear Students and Faculty members,", { align: "justify" }).moveDown(0.5);
  doc.text(`The ${event.club.clubName || 'College Club'} is pleased to announce the upcoming event "${event.title}". This event is designed to foster a culture of learning and competitive spirit among our students. We invite all eligible participants to join this initiative.`, { align: "justify", lineGap: 3 }).moveDown();
  
  // Structured Details Box
  const startX = 60;
  const tableTop = doc.y;
  doc.rect(startX, tableTop, 475, 130).fillAndStroke("#f8fafc", "#cbd5e1");
  
  doc.fillColor("#1e293b").fontSize(11).font("Helvetica-Bold").text("EVENT SPECIFICATIONS", startX + 15, tableTop + 15);
  doc.fillColor("black").font("Helvetica").fontSize(10);
  
  const drawRow = (label, value, y) => {
    doc.font("Helvetica-Bold").text(label, startX + 25, y);
    doc.font("Helvetica").text(`: ${value}`, startX + 150, y);
  };

  drawRow("EVENT TITLE", event.title, tableTop + 40);
  drawRow("DATE OF EVENT", new Date(event.date).toDateString(), tableTop + 60);
  drawRow("COMMENCEMENT", event.time || "09:00 AM Onwards", tableTop + 80);
  drawRow("VENUE", event.venue || "Main Auditorium", tableTop + 100);

  doc.moveDown(9);

  // Guidelines Section
  if (event.rules) {
    doc.fontSize(11).font("Helvetica-Bold").text("PARTICIPATION GUIDELINES & RULES:", { underline: true }).moveDown(0.5);
    doc.font("Helvetica").fontSize(10).text(event.rules, { align: "justify", lineGap: 2 }).moveDown();
  }

  doc.text("All registrations must be completed through the official college event portal. For further inquiries, please contact the student coordinators of the respective club.").moveDown(3);
  
  // Signatory Block
  const sigY = doc.y;
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("Approved By,", 60, sigY);
  doc.text("Issued By,", doc.page.width - 200, sigY);
  
  doc.moveDown(3);
  
  doc.text("DIRECTOR (ADMIN)", 60, doc.y);
  doc.text("STAFF COORDINATOR", doc.page.width - 200, sigY + 50);

  doc.pipe(res);
  doc.end();
};

const generateCircularFile = (event) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      
      const uploadsDir = path.join(__dirname, "..", "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
      
      const fileName = `circular_${event._id}_${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Logo Handling
      const LOGO_PATH = path.join(__dirname, "..", "uploads", "nec_logo.png");
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, 50, 45, { width: 60 });
        doc.fontSize(8).font("Helvetica").text("Estd : 1984", 50, 110, { width: 60, align: "center" });
      }

      // Main Header
      doc.font("Helvetica-Bold").fontSize(18).text("NATIONAL ENGINEERING COLLEGE", 0, 50, { align: "center" });
      doc.fontSize(9).font("Helvetica").text("(An Autonomous Institution, Affiliated to Anna University Chennai)", 0, 75, { align: "center" });
      doc.text("K.R. NAGAR, KOVILPATTI-628503", 0, 90, { align: "center" });

      doc.moveDown(2);
      const deptName = `DEPARTMENT OF ${event.department || "COMPUTER SCIENCE AND ENGINEERING"}`.toUpperCase();
      doc.font("Helvetica-Bold").fontSize(11).text(deptName, 0, 125, { align: "center" });

      doc.moveDown(1.5);
      const assocName = (event.associationName || `${event.clubId?.clubName || 'CLUB'} ASSOCIATION`).toUpperCase();
      doc.fontSize(11).text(assocName, 0, 160, { align: "center" });

      doc.moveDown(1.5);
      doc.fontSize(10).font("Helvetica").text(new Date().toLocaleDateString("en-GB"), 0, 185, { align: "right" });

      doc.moveDown(1);
      doc.font("Helvetica-Bold").fontSize(12).text("CIRCULAR", 0, 210, { align: "center", underline: true });

      doc.moveDown(2);
      
      // Formal Body
      const bodyText = `An event titled ${event.title} will be conducted on ${new Date(event.date).toLocaleDateString("en-GB")} from ${event.time || "TBD"} to ${event.endTime || "TBD"} at ${event.venue || "TBD"}. ${event.description || ""}`;
      
      doc.font("Helvetica").fontSize(11).text(bodyText, 60, doc.y, { align: "justify", lineGap: 5 });

      if (event.rules) {
        doc.moveDown();
        doc.font("Helvetica-Bold").text("General Rules:");
        doc.font("Helvetica").text(event.rules, { align: "justify", lineGap: 3 });
      }

      doc.moveDown(2);
      doc.text("Students are requested to register through the Register Link provided in the portal.");

      const regUrl = `http://localhost:5173/register.html?id=${event._id}`;
      doc.fillColor("blue").text(regUrl, { underline: true }).fillColor("black");

      doc.moveDown(5);
      
      // Signatures Table
      const footerY = doc.y;
      doc.font("Helvetica-Bold").fontSize(11);
      
      // Left: Staff Coordinator
      doc.text("Staff Coordinator", 60, footerY);
      
      // Right: HOD
      const hodTitle = `HOD/${event.department || "CSE"}`;
      doc.text(hodTitle, doc.page.width - 150, footerY);

      doc.end();
      writeStream.on("finish", () => resolve(`/uploads/${fileName}`));
      writeStream.on("error", reject);
    } catch (e) { 
      console.error("Circular generation error:", e);
      reject(e); 
    }
  });
};

const generateCertificateFile = (studentName, eventName, clubName, date, type = "Participation") => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ layout: "landscape", size: "A4" });
      
      const uploadsDir = path.join(__dirname, "..", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }
      
      const fileName = `certificate_${type.toLowerCase()}_${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);
      
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

      doc.fontSize(40).text(`CERTIFICATE OF ${type.toUpperCase()}`, { align: "center" }).moveDown();
      doc.fontSize(20).text("This is to certify that", { align: "center" }).moveDown(0.5);
      doc.fontSize(30).text(studentName, { align: "center", underline: true }).moveDown(0.5);
      
      if (type === "Participation") {
        doc.fontSize(20).text(`has successfully participated in the event`, { align: "center" }).moveDown(0.5);
      } else {
        doc.fontSize(20).text(`has secured the ${type} position in the event`, { align: "center" }).moveDown(0.5);
      }
      
      doc.fontSize(25).text(eventName, { align: "center" }).moveDown(0.5);
      doc.fontSize(20).text(`organized by ${clubName}`, { align: "center" }).moveDown();
      doc.fontSize(15).text(`Date: ${new Date(date).toDateString()}`, { align: "right" });

      doc.end();
      
      writeStream.on("finish", () => resolve(filePath));
      writeStream.on("error", reject);
    } catch (e) {
      reject(e);
    }
  });
};

const generateClubReport = (club, events, month, year, res) => {
  const doc = new PDFDocument();
  const monthName = month ? new Date(year, month - 1).toLocaleString('default', { month: 'long' }) : "Full Year";

  doc.fontSize(22).text(`${club.clubName} - Event Report`, { align: "center" }).moveDown();
  doc.fontSize(16).text(`Period: ${monthName} ${year}`, { align: "center" }).moveDown();
  
  doc.fontSize(12).text(`Staff Coordinator: ${club.coordinator.name}`);
  doc.fontSize(12).text(`Student Coordinator: ${club.studentCoordinator ? club.studentCoordinator.name : 'N/A'}`);
  doc.fontSize(12).text(`Department: ${club.department}`).moveDown();

  doc.text("------------------------------------------------------------").moveDown();

  if (events.length === 0) {
    doc.text("No events found for this period.");
  } else {
    events.forEach((event, index) => {
      doc.fontSize(14).text(`${index + 1}. ${event.title}`, { underline: true });
      doc.fontSize(11).text(`Date: ${new Date(event.date).toLocaleDateString()}`);
      doc.fontSize(11).text(`Venue: ${event.venue}`);
      doc.fontSize(11).text(`Status: ${event.status.toUpperCase()}`);
      if (event.status === 'published' || event.status === 'approved') {
        doc.fontSize(11).text(`Attendance: ${event.attendance || 0} students`);
      }
      doc.moveDown();
    });
  }

  doc.text("------------------------------------------------------------", { align: "bottom" });
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: "right" });

  doc.pipe(res);
  doc.end();
};

module.exports = { generateCertificate, generateCircular, generateClubReport, generateCircularFile, generateCertificateFile };
