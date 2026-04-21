const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "hod", "staff", "student"],
      required: true,
    },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    associationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Association",
    },
    clubName: {
      type: String,
      default: "",
    },
    department: {
      type: String,
    },
    year: {
      type: Number,
    },
    registerNumber: {
      type: String,
    },
    phone: {
      type: String,
    },
    profilePic: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    invitationToken: String,
    invitationTokenExpire: Date,
    isSetup: {
      type: Boolean,
      default: false,
    },
    pendingClubJoin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    pendingTransactionId: {
      type: String,
    },
  },
  { timestamps: true }
);

//
// 🔐 Hash password before saving
//
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

//
// 🔎 Compare entered password with hashed password
//
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
