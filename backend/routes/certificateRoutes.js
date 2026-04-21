const express = require("express");
const { generateAndSendCertificates, downloadCertificatesZip } = require("../controllers/certificateController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/generate/:eventId", protect, authorize("student", "staff"), generateAndSendCertificates);
router.get("/download-zip/:eventId", protect, authorize("student", "staff"), downloadCertificatesZip);

module.exports = router;
