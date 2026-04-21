const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");

dotenv.config();

const forceCreateUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Delete existing users with these emails to be sure
    await User.deleteMany({ email: { $in: ["admin@college.edu", "hod@college.edu"] } });

    await User.create([
      {
        name: "Super Admin",
        email: "admin@college.edu",
        password: "admin123",
        role: "admin"
      },
      {
        name: "HOD CSE",
        email: "hod@college.edu",
        password: "hod123",
        role: "hod"
      }
    ]);

    console.log("Admin and HOD created/reset successfully.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

forceCreateUsers();
