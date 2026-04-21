const mongoose = require("mongoose");

const feedbackResponseSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Optional, depending on if non-registered users can submit, but we link it anyway
    },
    studentName: {
      type: String,
      required: true,
    },
    email: {
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
    answers: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId },
        questionText: { type: String },
        answer: { type: mongoose.Schema.Types.Mixed, required: true },
      },
    ],
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeedbackResponse", feedbackResponseSchema);
