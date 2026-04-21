const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const Club = require("./models/Club");
const Association = require("./models/Association");

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/club-events", { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to MongoDB.");

    const ramPriya = await User.find({ name: { $regex: /Ram Priya/i } });
    if (ramPriya.length === 0) {
      console.log("No user found with name Ram Priya");
      process.exit(0);
    }

    for (const user of ramPriya) {
      console.log(`\n=== User: ${user.name} | Role: ${user.role} | ID: ${user._id} ===`);
      console.log(`Email: ${user.email}`);
      console.log(`clubId: ${user.clubId}`);
      console.log(`clubName: ${user.clubName}`);
      console.log(`associationId: ${user.associationId}`);

      // Check Clubs
      const clubsWhereMember = await Club.find({ members: user._id });
      console.log(`Clubs (members): ${clubsWhereMember.map(c => c.clubName).join(", ")}`);

      const clubsWhereStudentCoord = await Club.find({ studentCoordinators: user._id });
      console.log(`Clubs (studentCoordinators): ${clubsWhereStudentCoord.map(c => c.clubName).join(", ")}`);

      // Check Associations
      const assocsWhereStudentCoord = await Association.find({ studentCoordinators: user._id });
      console.log(`Associations (studentCoordinators): ${assocsWhereStudentCoord.map(a => a.name).join(", ")}`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
};

run();
