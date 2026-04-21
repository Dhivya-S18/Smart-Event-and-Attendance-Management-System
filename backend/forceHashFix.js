const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const forceHashPasswords = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash("123456", salt);

        console.log("Applying universal hash to all users...");
        const result = await User.updateMany({}, { $set: { password: newHash } });
        
        console.log(`Successfully updated ${result.modifiedCount} users to the correct hashed '123456'.`);

        // Test one user
        const devUser = await User.findOne({ email: "codingclub.student1@college.edu" });
        if (devUser) {
            const isMatch = await devUser.matchPassword('123456');
            console.log(`Verification - Student login allowed: ${isMatch}`);
        } else {
            console.log("Student user missing?");
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

forceHashPasswords();
