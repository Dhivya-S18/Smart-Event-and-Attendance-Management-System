const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const clearEvents = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB...");

    // Remove all registrations
    try {
        await mongoose.connection.db.collection("registrations").deleteMany({});
        console.log("Cleared all registrations.");
    } catch (e) {
        console.log("Registrations collection doesn't exist or already empty.");
    }

    // Remove all events
    try {
        await mongoose.connection.db.collection("events").deleteMany({});
        console.log("Cleared all events.");
    } catch (e) {
        console.log("Events collection doesn't exist or already empty.");
    }

    console.log("Event data cleared successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Clear failed:", error);
    process.exit(1);
  }
};

clearEvents();
