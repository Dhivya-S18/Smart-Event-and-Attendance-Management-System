const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema(
  {
    clubName: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    clubType: {
      type: String,
      enum: ["department", "shared", "independent"],
      required: true,
    },
    departmentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
      },
    ],
    hods: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    staffCoordinators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    studentCoordinators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    eventVisibility: {
      type: String,
      enum: ["public", "members_only"],
      default: "public",
    },
    membershipType: {
      type: String,
      enum: ["controlled", "open"],
      default: "controlled",
    },
    memberLimit: {
      type: Number,
      default: 0, // 0 means unlimited
    },
    isPaidMembership: {
      type: Boolean,
      default: false,
    },
    membershipFee: {
      type: Number,
      default: 0,
    },
    joinRequests: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        transactionId: String,
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        appliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isPublishedForRegistration: {
      type: Boolean,
      default: false,
    },
    hasJoinForm: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Club", clubSchema);
