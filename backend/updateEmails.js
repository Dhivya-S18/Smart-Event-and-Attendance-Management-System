const mongoose = require("mongoose");
const User = require("./models/User");
const Club = require("./models/Club");
const dotenv = require("dotenv");

dotenv.config();

const updateEmails = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        const users = await User.find({}).populate("clubId");
        console.log(`Found ${users.length} users. Updating...`);

        let studentCount = 1;
        
        for (let user of users) {
            let email = "";
            
            // Password for all is "123456"
            user.password = "123456";

            if (user.role === "admin") {
                email = "admin@gmail.com";
            } else if (user.role === "hod") {
                let deptName = user.department ? user.department.toLowerCase().replace(/\s+/g, "") : "unknown";
                if (deptName === "unknown" && user.name) {
                    // Try to extract from name e.g. "HOD CSE"
                    const parts = user.name.split(" ");
                    if (parts.length > 1) {
                        deptName = parts[1].toLowerCase();
                    }
                }
                email = `${deptName}hod@gmail.com`;
            } else if (user.role === "staff") {
                let clubName = user.clubId && user.clubId.clubName ? user.clubId.clubName.toLowerCase().replace(/\s+/g, "") : "unknownclub";
                email = `staff${clubName}@gmail.com`;
                // To avoid duplicate staff emails if multiple staff have same role or no club
                if (clubName === "unknownclub") {
                    email = `staff${Math.floor(Math.random() * 1000)}@gmail.com`;
                }
            } else if (user.role === "student") {
                email = `clubmember_${studentCount}@gmail.com`;
                studentCount++;
            } else {
                email = `user_${Math.floor(Math.random() * 10000)}@gmail.com`;
            }

            user.email = email;
            
            try {
                await user.save();
                console.log(`Updated: ${email}`);
            } catch (err) {
                console.log(`Error updating ${email}:`, err.message);
                if (err.code === 11000) {
                   // if email exists, let's append a random number
                   user.email = `${email.split('@')[0]}${Math.floor(Math.random() * 1000)}@gmail.com`;
                   try { 
                       await user.save(); 
                       console.log(`Updated with fallback: ${user.email}`);
                   } catch (e) {
                      console.log(`Still failed for ${user.email} `, e.message);
                   }
                }
            }
        }

        console.log("Database email and password update complete.");
        process.exit(0);
    } catch (err) {
        console.error("Update failed:", err);
        process.exit(1);
    }
};

updateEmails();
