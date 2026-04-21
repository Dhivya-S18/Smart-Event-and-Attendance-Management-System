const mongoose = require("mongoose");

const feedbackFormSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    questions: [
      {
        questionText: { type: String, required: true },
        type: { type: String, enum: ["text", "rating", "boolean"], default: "text" },
        required: { type: Boolean, default: true },
      },
    ],
    isPublished: {
      type: Boolean,
      default: false,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    feedbackLink: {
      type: String,
    },
    qrCodeUrl: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeedbackForm", feedbackFormSchema);
