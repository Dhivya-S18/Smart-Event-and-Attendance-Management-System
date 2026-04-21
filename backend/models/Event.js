const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    venue: {
      type: String,
      required: true,
    },
    time: {
      type: String,
    },
    endTime: {
      type: String,
    },
    hasRounds: {
      type: Boolean,
      default: false,
    },
    eventRounds: {
      type: Number,
      default: 1,
    },
    isTeamEvent: {
      type: Boolean,
      default: false,
    },
    maxTeamSize: {
      type: Number,
      default: 1,
    },
    expectedParticipants: {
      type: Number,
    },
    contactDetails: {
      type: String,
    },
    memberDetails: {
      type: String, // Individual or Team
    },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    associationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Association",
    },
    department: {
      type: String, // Copied from club for easier filtering
      required: true,
    },
    rules: {
      type: String,
    },
    teamMembers: [
      {
        name: String,
        registerNumber: String,
      },
    ],
    selectedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending_staff_approval", "circular_creation_pending", "pending_hod_approval", "published", "rejected", "completed"],
      default: "pending_staff_approval",
    },
    staffApproved: {
      type: Boolean,
      default: false,
    },
    hodApproved: {
      type: Boolean,
      default: false,
    },
    hodApprovals: [
      {
        hodId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
        feedback: String,
        updatedAt: { type: Date, default: Date.now }
      }
    ],
    published: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    attendance: {
      type: Number,
      default: 0,
    },
    poster: {
      type: String, // Kept for backwards compatibility
    },
    posterImage: {
      type: String,
    },
    circularPdf: {
      type: String,
    },
    registrationEnabled: {
      type: Boolean,
      default: false,
    },
    feedbackEnabled: {
      type: Boolean,
      default: false,
    },
    certificatesSent: {
      type: Boolean,
      default: false,
    },
    registrationLink: {
      type: String,
    },
    feedbackLink: {
      type: String,
    },
    staffFeedback: {
      type: String,
    },
    hodFeedback: {
      type: String,
    },
    posterTagline: {
      type: String,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    president: { type: String },
    vicePresident: { type: String },
    security: { type: String },
    otherCoordinator: { type: String },
    staffCoordinator1: { type: String },
    staffCoordinator2: { type: String },
    studentCoordinator1: { type: String },
    studentCoordinator2: { type: String },
    associationName: { type: String },
    eventType: { type: String },
    allowedYears: [{ type: Number }],
    allowedDepartments: [{ type: String }],
    maxParticipants: {
      type: Number,
      default: 0,
    },
    maxTeams: {
      type: Number,
      default: 0,
    },
    registeredCount: {
      type: Number,
      default: 0,
    },
    registeredTeamsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);

