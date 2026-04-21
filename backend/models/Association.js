const mongoose = require("mongoose");

const associationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    hodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    staffCoordinators: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    studentCoordinators: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Association", associationSchema);
