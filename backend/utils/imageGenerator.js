const { Jimp, loadFont, HorizontalAlign, rgbaToInt, intToRGBA } = require("jimp");
const path = require("path");
const fs = require("fs");
const https = require("https");
const QRCode = require("qrcode");

const LOGO_URL = "https://www.nec.edu.in/wp-content/uploads/2019/08/logo.png";
const LOGO_PATH = path.join(__dirname, "..", "uploads", "nec_logo.png");

// Helper to download logo if it doesn't exist
const ensureLogo = async () => {
  if (fs.existsSync(LOGO_PATH) && fs.statSync(LOGO_PATH).size > 100) return true;
  return new Promise((resolve) => {
    https.get(LOGO_URL, (response) => {
      if (response.statusCode === 200) {
        const writer = fs.createWriteStream(LOGO_PATH);
        response.pipe(writer);
        writer.on('finish', () => resolve(true));
      } else resolve(false);
    }).on('error', () => resolve(false));
  });
};

const setupFonts = async () => {
    const fontBase = path.join(__dirname, "..", "node_modules", "@jimp", "plugin-print", "fonts", "open-sans");
    try {
        const xl = await loadFont(path.join(fontBase, "open-sans-128-white", "open-sans-128-white.fnt"));
        const lg = await loadFont(path.join(fontBase, "open-sans-64-white", "open-sans-64-white.fnt"));
        const md = await loadFont(path.join(fontBase, "open-sans-32-white", "open-sans-32-white.fnt"));
        const sm = await loadFont(path.join(fontBase, "open-sans-16-white", "open-sans-16-white.fnt"));
        return { xl, lg, md, sm };
    } catch(e) {
        const xl = await loadFont("open-sans-128-white");
        const lg = await loadFont("open-sans-64-white");
        const md = await loadFont("open-sans-32-white");
        const sm = await loadFont("open-sans-16-white");
        return { xl, lg, md, sm };
    }
};

const getBlackFonts = async () => {
    const fontBase = path.join(__dirname, "..", "node_modules", "@jimp", "plugin-print", "fonts", "open-sans");
    try {
        const lg = await loadFont(path.join(fontBase, "open-sans-64-black", "open-sans-64-black.fnt"));
        const md = await loadFont(path.join(fontBase, "open-sans-32-black", "open-sans-32-black.fnt"));
        const sm = await loadFont(path.join(fontBase, "open-sans-16-black", "open-sans-16-black.fnt"));
        return { lg, md, sm };
    } catch(e) {
        return {
            lg: await loadFont("open-sans-64-black"),
            md: await loadFont("open-sans-32-black"),
            sm: await loadFont("open-sans-16-black")
        };
    }
};

const drawGlow = (image, cx, cy, radius, r, g, b, opacity) => {
    const width = 800; const height = 1100;
    for (let y = cy - radius; y < cy + radius; y++) {
        for (let x = cx - radius; x < cx + radius; x++) {
            if (x >= 0 && x < width && y >= 0 && y < height) {
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                if (dist < radius) {
                    const alpha = Math.floor(opacity * (1 - dist / radius));
                    const current = intToRGBA(image.getPixelColor(x, y));
                    const newR = Math.min(255, current.r + (r * alpha / 255));
                    const newG = Math.min(255, current.g + (g * alpha / 255));
                    const newB = Math.min(255, current.b + (b * alpha / 255));
                    image.setPixelColor(rgbaToInt(newR, newG, newB, 255), x, y);
                }
            }
        }
    }
};

const generatePoster = async (eventDetails, templateIdStr = "1") => {
  try {
    const templateId = parseInt(templateIdStr) || 1;
    const width = 800;
    const height = 1100;
    
    await ensureLogo();

    let image;
    let fonts;
    let textColors = { header: 0xffffffff, primary: 0xffffffff, accent: 0xffffffff };

    // ============================================
    // BACKGROUND & THEME LOGIC
    // ============================================
    if (templateId === 1) {
        // Tech / Hackathon (Dark Neon Blue/Orange)
        image = new Jimp({ width, height, color: 0x0f172aff }); 
        drawGlow(image, 400, 500, 600, 14, 165, 233, 100); // Blue center glow
        drawGlow(image, 100, 1000, 400, 249, 115, 22, 120); // Orange bottom glow
        fonts = await setupFonts();
        textColors.accent = rgbaToInt(249, 115, 22, 255);
    } else if (templateId === 2) {
        // Minimal Academic (Light)
        image = new Jimp({ width, height, color: 0xf8fafcff });
        for(let i=0; i<width; i+=40) {
            image.scan(i, 0, 1, height, function(x, y, idx) { this.setPixelColor(0xe2e8f0ff, x, y); });
        }
        for(let i=0; i<height; i+=40) {
            image.scan(0, i, width, 1, function(x, y, idx) { this.setPixelColor(0xe2e8f0ff, x, y); });
        }
        fonts = await getBlackFonts();
        const fallbackWhite = await setupFonts(); 
        fonts.xl = fallbackWhite.xl; // keep white for large accents if needed, but we'll stick to black lg
    } else if (templateId === 3) {
        // Dark Corporate
        image = new Jimp({ width, height, color: 0x1e293bff });
        for (let y = 0; y < height; y++) {
            const ratio = y / height;
            const r = Math.floor(15 + ratio * 20);
            const g = Math.floor(23 + ratio * 30);
            const b = Math.floor(42 + ratio * 60);
            image.scan(0, y, width, 1, function(x, yy, idx) { this.setPixelColor(rgbaToInt(r, g, b, 255), x, yy); });
        }
        fonts = await setupFonts();
        textColors.accent = rgbaToInt(250, 204, 21, 255); // Gold
    } else if (templateId === 4) {
        // Vibrant Gradient (Pink/Orange)
        image = new Jimp({ width, height, color: 0xec4899ff });
        drawGlow(image, 0, 1100, 900, 249, 115, 22, 255); // Orange glow masking
        drawGlow(image, 800, 0, 800, 139, 92, 246, 255); // Purple
        fonts = await setupFonts();
    } else {
        // Template 5: Cyberpunk
        image = new Jimp({ width, height, color: 0x000000ff });
        drawGlow(image, 800, 1100, 500, 220, 38, 38, 150); // Red
        drawGlow(image, 0, 0, 500, 250, 204, 21, 150); // Yellow
        for (let y = 0; y < height; y+=5) {
            image.scan(0, y, width, 1, function(x, yy, idx) { this.setPixelColor(rgbaToInt(255, 255, 255, 15), x, yy); });
        }
        fonts = await setupFonts();
        textColors.accent = rgbaToInt(250, 204, 21, 255);
    }

    // ============================================
    // HEADER (Always visible - National Engineering College)
    // ============================================
    try {
        if (fs.existsSync(LOGO_PATH)) {
            const logo = await Jimp.read(LOGO_PATH);
            logo.resize({ w: 80, h: 80 });
            image.composite(logo, 30, 30);
        }
    } catch(err) {
        console.warn("Logo failed to load on poster generated image.");
    }

    // Header Text
    image.print({ font: fonts.md, x: 130, y: 35, text: "NATIONAL ENGINEERING COLLEGE" });
    image.print({ font: fonts.sm, x: 130, y: 75, text: "An Autonomous Institution, Affiliated to Anna University" });
    
    // Top line separator
    image.scan(30, 130, width - 60, 2, function(x, y, idx) { this.setPixelColor(templateId === 2 ? 0x94a3b8ff : 0xffffffff, x, y); });

    // ============================================
    // CENTRAL CONTENT
    // ============================================
    const deptStr = `DEPARTMENT OF ${eventDetails.department || "ACADEMICS"}`.toUpperCase();
    image.print({ font: fonts.md, x: 0, y: 160, text: { text: deptStr, alignmentX: HorizontalAlign.CENTER, alignmentY: HorizontalAlign.MIDDLE }, maxWidth: 800 });

    const title = (eventDetails.title || "ANNUAL EVENT").toUpperCase();
    
    // Add title shadow/glow for specific templates
    if (templateId === 1 || templateId === 5) {
        image.print({ font: fonts.lg, x: 3, y: 263, text: { text: title, alignmentX: HorizontalAlign.CENTER, alignmentY: HorizontalAlign.MIDDLE }, maxWidth: 800 }); // Shadow
    }
    
    image.print({ font: fonts.lg, x: 0, y: 260, text: { text: title, alignmentX: HorizontalAlign.CENTER, alignmentY: HorizontalAlign.MIDDLE }, maxWidth: 800 });

    const tagline = (eventDetails.tagline || "Join us for an amazing experience!").toUpperCase();
    image.print({ font: fonts.sm, x: 100, y: 400, text: { text: tagline, alignmentX: HorizontalAlign.CENTER, alignmentY: HorizontalAlign.MIDDLE }, maxWidth: 600 });
    
    const rulesText = eventDetails.rules || "Participate to showcase your skills.";
    image.print({ font: fonts.sm, x: 100, y: 450, text: { text: rulesText, alignmentX: HorizontalAlign.CENTER, alignmentY: HorizontalAlign.MIDDLE }, maxWidth: 600 });

    // ============================================
    // BOTTOM DETAILS & QR
    // ============================================
    const detailY = 800;
    
    // Create a detail box overlay
    if (templateId === 1 || templateId === 4) {
        const rBox = templateId === 1 ? rgbaToInt(0, 0, 0, 100) : rgbaToInt(255, 255, 255, 50);
        for(let yy = detailY - 20; yy < detailY + 200; yy++){
            image.scan(40, yy, 720, 1, function(x, cy, idx){ this.setPixelColor(rBox, x, cy); });
        }
    }

    const dateStr = `DATE:  ${new Date(eventDetails.date).toLocaleDateString()}`;
    const venueStr = `VENUE: ${eventDetails.venue || "TBD"}`.toUpperCase();
    const timeStr = `TIME:  ${eventDetails.time || "09:00 AM"}`;

    image.print({ font: fonts.md, x: 60, y: detailY, text: venueStr });
    image.print({ font: fonts.md, x: 60, y: detailY + 60, text: dateStr });
    image.print({ font: fonts.md, x: 60, y: detailY + 120, text: timeStr });

    // QR CODE Logic
    const qrLink = eventDetails.registrationLink || "https://nec.edu.in";
    try {
        const qrBuffer = await QRCode.toBuffer(qrLink, {
            errorCorrectionLevel: 'H',
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' },
            width: 180
        });
        const qrImg = await Jimp.read(qrBuffer);
        image.composite(qrImg, 560, detailY - 10);
        image.print({ font: fonts.sm, x: 560, y: detailY + 180, text: "SCAN TO REGISTER" });
    } catch(qrErr) {
        console.warn("Could not generate QR: ", qrErr.message);
    }

    // Footer
    const organizer = `ORGANIZED BY: ${eventDetails.clubName || "STUDENT COUNCIL"}`.toUpperCase();
    if (eventDetails.staffCoordinator2) {
       const coName = `STAFF COORDINATOR: ${eventDetails.staffCoordinator2}`.toUpperCase();
       image.print({ font: fonts.sm, x: 0, y: 1000, text: { text: coName, alignmentX: HorizontalAlign.CENTER }, maxWidth: 800 });
    }
    if (eventDetails.studentCoordinator2) {
       const stuName = `STUDENT COORDINATOR: ${eventDetails.studentCoordinator2}`.toUpperCase();
       image.print({ font: fonts.sm, x: 0, y: 1025, text: { text: stuName, alignmentX: HorizontalAlign.CENTER }, maxWidth: 800 });
    }
    image.print({ font: fonts.sm, x: 0, y: 1050, text: { text: organizer, alignmentX: HorizontalAlign.CENTER }, maxWidth: 800 });

    const uploadsDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const fileName = `poster_tpl${templateId}_${Date.now()}.jpeg`;
    const outputPath = path.join(uploadsDir, fileName);

    await image.write(outputPath);

    return `/uploads/${fileName}`; 
  } catch (error) {
    console.error("Error generating poster:", error);
    throw new Error("Poster generation failed: " + error.message);
  }
};

const generateQRCodeDataURL = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 500,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error("QR Code Error:", err);
    throw err;
  }
};

module.exports = { generatePoster, generateQRCodeDataURL };
