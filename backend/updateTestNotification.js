const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");

dotenv.config();

const realNames = [
    "Arun Kumar", "Priya Lakshmi", "Vijay Ragavan", "Deepa Senthil", "Suresh Raina",
    "Anitha Devi", "Rajesh Khanna", "Meena Kumari", "Karthik Raja", "Sandhiya Rao",
    "Ganesh Moorthy", "Divya Bharathi", "Naveen Kumar", "Swathi Reddy", "Prakash Raj",
    "Ishwarya Balan", "Vignesh Shivan", "Pavithra Singh", "Manoj Bajpayee", "Sneha Ullal"
];

const updateToTestNotification = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        // Drop the unique email index from MongoDB directly
        try {
            await User.collection.dropIndex("email_1");
            console.log("Unique email index dropped.");
        } catch (e) {
            console.log("Unique index might not exist or already dropped.");
        }

        const users = await User.find({});
        console.log(`Updating ${users.length} users...`);

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            
            // Assign real names from the list (cycling through if needed)
            user.name = realNames[i % realNames.length] + (i >= realNames.length ? ` ${Math.floor(i/realNames.length)}` : "");
            
            // All users get the SAME email for notification testing
            user.email = "2312052@nec.edu.in";
            
            // All users get the same phone
            user.phone = "9514554001";
            
            // Register Number for students (following the pattern)
            if (user.role === "student") {
                user.registerNumber = `2312${(i + 1).toString().padStart(3, '0')}`;
            }

            // Ensure password is simple for testing
            user.password = "password123";

            await user.save();
        }

        console.log("All users now share 2312052@nec.edu.in and have real names.");
        process.exit(0);
    } catch (err) {
        console.error("Update failed:", err);
        process.exit(1);
    }
};

updateToTestNotification();
