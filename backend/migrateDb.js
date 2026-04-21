const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");

dotenv.config();

const migrateDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");
        
        // Add default 'phone' field to all existing users that don't have it
        const result = await User.updateMany(
            { phone: { $exists: false } },
            { $set: { phone: "" } }
        );

        console.log(`Database updated: ${result.modifiedCount} users modified.`);
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
};

migrateDb();
