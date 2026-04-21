const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");

dotenv.config();

const debugStudent = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = 'codingclub.student1@college.edu';
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log(`User ${email} NOT FOUND in DB!`);
        } else {
            console.log(`User ${email} FOUND.`);
            console.log(`Stored password hash: ${user.password}`);
            const isMatch = await user.matchPassword('123456');
            console.log(`matchPassword('123456') returns: ${isMatch}`);
            
            if (!isMatch) {
                console.log("Forcing safe hash update...");
                const bcrypt = require("bcryptjs");
                const salt = await bcrypt.genSalt(10);
                const newHash = await bcrypt.hash("123456", salt);
                await User.updateOne({ email }, { $set: { password: newHash } });
                console.log("Direct MongoDB updateOne applied with new bcrypt hash.");
            }
        }
        
        const adminEmail = 'admin@gmail.com';
        const adminUser = await User.findOne({ email: adminEmail });
        if (adminUser) {
            const adminMatch = await adminUser.matchPassword('123456');
            console.log(`Admin ${adminEmail} matchPassword('123456') returns: ${adminMatch}`);
        }

        process.exit(0);
    } catch (e) {
        console.log("Error:", e);
        process.exit(1);
    }
};

debugStudent();
