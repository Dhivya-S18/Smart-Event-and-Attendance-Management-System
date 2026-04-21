const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    rounds: [
      {
        roundName: { type: String, required: true },
        roundDescription: { type: String },
      },
    ],
    winners: [
      {
        studentName: { type: String, required: true },
        registerNumber: { type: String },
        email: { type: String, required: false },
        department: { type: String },
        year: { type: String },
        ranking: { type: String }, // For ranks like 1st, 2nd, 3rd
      },
    ],
    photos: [
      {
        url: { type: String },
        caption: { type: String },
      },
    ],
    venue: { type: String },
    dateTime: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    staffCoordinator: { type: String },
    hod: { type: String },
    dean: { type: String },
    principal: { type: String },
    posterUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
