const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  const user = await User.create({ name, email, password, role });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id),
  });
};


const getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const query = role ? { role } : {};
    const users = await User.find(query).select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const crypto = require("crypto");

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "There is no user with that email" });
    }

    // Requirements: Forgot password allowed only for 'staff' and 'coordinator'
    if (user.role === "hod" || user.role === "admin") {
      return res.status(403).json({ message: "Password reset for Admins and HODs must be done through system administrators." });
    }

    // Generate token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Set expire (10 minutes)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save();

    // In a real app, send actual email here.
    // For this mockup, we just return the raw token.
    res.status(200).json({
      message: "Reset link sent to email.",
      debugToken: resetToken
    });
  } catch (error) {
    res.status(500).json({ message: "Email could not be sent" });
  }
};

const resetPassword = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.resetToken).digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset password" });
  }
}

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("clubId", "clubName")
      .populate("associationId", "name");
    
    if (!user) return res.status(404).json({ message: "User not found" });

    const userObj = user.toObject();
    if (user.clubId) {
      userObj.clubName = user.clubId.clubName;
      userObj.clubId = user.clubId._id;
    } else if (user.associationId) {
      userObj.clubName = user.associationId.name;
      userObj.associationId = user.associationId._id;
    }

    if (!userObj.registerNumber && userObj.role === 'student' && userObj.email) {
      userObj.registerNumber = userObj.email.split('@')[0];
    }

    res.json(userObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, email, phone, registerNumber, bio, department } = req.body;

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ message: "Email already in use" });
      user.email = email;
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (department !== undefined) user.department = department;
    if (registerNumber !== undefined && user.role === "student") user.registerNumber = registerNumber;

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      registerNumber: user.registerNumber,
      department: user.department,
      bio: user.bio,
      message: "Profile updated successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, getUsers, forgotPassword, resetPassword, updateProfile, getProfile };
