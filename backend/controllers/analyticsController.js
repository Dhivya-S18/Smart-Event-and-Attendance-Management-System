const Event = require("../models/Event");
const User = require("../models/User");
const Club = require("../models/Club");

const getAnalytics = async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalClubs = await Club.countDocuments();
    const eventsByStatus = await Event.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    res.json({
      totalEvents,
      totalUsers,
      totalClubs,
      eventsByStatus
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generateCircular = async (req, res) => {
  // Dummy implementation - in real app, generate PDF or send email
  res.json({ message: "Circular generated successfully" });
};

const generateCertificate = async (req, res) => {
  // Dummy implementation - in real app, generate certificate PDF
  res.json({ message: "Certificate generated successfully" });
};

module.exports = { getAnalytics, generateCircular, generateCertificate };
