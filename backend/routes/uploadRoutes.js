const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/authMiddleware");
const User = require("../models/User");
const { Jimp } = require("jimp"); // Using jimp for resizing

const router = express.Router();

// 📂 Ensure directory exists
const uploadDir = path.join(__dirname, "../uploads/profiles");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 📁 Configure Memory Storage for processing
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Images only (jpg, jpeg, png, webp)!"));
  },
}).single("image");

// Wrapper to handle Multer errors
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Multer Error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// @route   POST /api/upload/profile
// @desc    Upload & Resize profile picture
// @access  Private
router.post("/", protect, uploadMiddleware, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const userId = req.user._id || req.user.id;
    const filename = `profile-${userId}-${Date.now()}.jpeg`; // Saving as jpeg for Jimp compatibility
    const filepath = path.join(uploadDir, filename);
    const imageUrl = `/uploads/profiles/${filename}`;

    // 🖼️ Resize with Jimp
    try {
      const image = await Jimp.read(req.file.buffer);
      
      // Resize to 400x400 (Cover mode - crops to center)
      image.cover({ w: 400, h: 400 });
      
      // Save the processed image
      await image.write(filepath);
    } catch (jimpErr) {
      console.error("Jimp Processing Error:", jimpErr);
      return res.status(500).json({ message: "Error processing image: " + jimpErr.message + " stack: " + jimpErr.stack });
    }
    
    // Update user in DB
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    // Delete old profile pic if exists
    if (user.profilePic) {
      const oldPath = path.join(__dirname, "..", user.profilePic);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    user.profilePic = imageUrl;
    await user.save();

    res.json({ imageUrl, message: "Profile picture resized and updated successfully" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Internal server error during upload: " + err.message + " stack: " + err.stack });
  }
});

// @route   DELETE /api/upload/profile
// @desc    Delete profile picture
// @access  Private
router.delete("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.profilePic = "";
    await user.save();
    res.json({ message: "Profile picture removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
