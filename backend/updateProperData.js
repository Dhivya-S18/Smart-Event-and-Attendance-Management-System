const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");

dotenv.config();

const updateToProperData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        const users = await User.find({});
        console.log(`Found ${users.length} users. Updating...`);

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const suffix = (i + 1).toString().padStart(3, '0');
            
            // Generate Reg No based on pattern: 23 (batch) + 1 (batch priority) + 2 (dept) + 0XX (i)
            // User example: 2312052
            const regNo = `2312${suffix}`;
            const email = `${regNo}@nec.edu.in`;
            const phone = "9514554001";
            
            // Keep original roles, but standardize names and contact info
            let name = user.role.charAt(0).toUpperCase() + user.role.slice(1) + " " + (i + 1);
            if (user.role === "admin") {
                user.email = "admin@nec.edu.in";
                user.name = "System Admin";
            } else if (user.role === "hod") {
                user.email = "hod@nec.edu.in";
                user.name = "HOD CSE";
            } else if (user.role === "staff") {
                user.email = `staff${suffix}@nec.edu.in`;
                user.name = `Staff Coordinator ${suffix}`;
            } else {
                user.email = email;
                user.registerNumber = regNo;
                user.name = `Student ${suffix}`;
            }
            
            user.phone = phone;
            
            // Password reset to a common one for testing
            user.password = "password123"; 

            try {
                await user.save();
            } catch (saveErr) {
                // If email already exists (e.g. from previous run or admin/hod overlap), skip or modify
                console.log(`Skipping overlap: ${user.email}`);
            }
        }

        console.log("Database update complete with proper data patterns.");
        process.exit(0);
    } catch (err) {
        console.error("Update failed:", err);
        process.exit(1);
    }
};

updateToProperData();
