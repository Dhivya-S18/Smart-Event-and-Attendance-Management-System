const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    registerNumber: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    teamMembers: [
      {
        name: String,
        registerNumber: String,
        email: String,
        attended: { type: Boolean, default: false },
        feedbackSubmitted: { type: Boolean, default: false },
      },
    ],
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    attended: {
      type: Boolean,
      default: false,
    },
    feedbackSubmitted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Registration", registrationSchema);
