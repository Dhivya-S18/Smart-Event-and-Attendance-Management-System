const express = require("express");
const router = express.Router();
const { 
    getReport, 
    createOrUpdateReport, 
    deleteReport, 
    generatePDF, 
    generateDOCX 
} = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 📂 Ensure reports upload directory exists
const uploadDir = path.join(__dirname, "../uploads/reports");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 📁 Configure Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `report-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Images only (jpg, jpeg, png, webp)!"));
  },
});


// All routes require authentication
router.use(protect);

router.get("/:eventId", getReport);
router.post("/", createOrUpdateReport);
router.delete("/:id", deleteReport);
router.get("/:eventId/pdf", generatePDF);
router.get("/:eventId/docx", generateDOCX);

// 📸 Photo Upload for Reports
router.post("/upload-photo", (req, res, next) => {
  upload.single("photo")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: "Multer Error: " + err.message });
    } else if (err) {
      return res.status(400).json({ message: "Upload Error: " + err.message });
    }
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const imageUrl = `/uploads/reports/${req.file.filename}`;
    res.json({ imageUrl });
  });
});


module.exports = router;
