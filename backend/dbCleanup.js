const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const fixDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB...");

    // Drop the clubs collection to clear old indices and data
    try {
        await mongoose.connection.db.collection("clubs").drop();
        console.log("Dropped clubs collection.");
    } catch (e) {
        console.log("Clubs collection doesn't exist or already dropped.");
    }

    // Drop the events collection to clear old data
    try {
        await mongoose.connection.db.collection("events").drop();
        console.log("Dropped events collection.");
    } catch (e) {
        console.log("Events collection doesn't exist or already dropped.");
    }

    // Drop the users collection to clear old data
    try {
        await mongoose.connection.db.collection("users").drop();
        console.log("Dropped users collection.");
    } catch (e) {
        console.log("Users collection doesn't exist or already dropped.");
    }

    console.log("Database cleanup finished.");
    process.exit(0);
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  }
};

fixDatabase();
