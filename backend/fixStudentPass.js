const mongoose = require("mongoose");
const User = require("./models/User");
const Club = require("./models/Club");
const dotenv = require("dotenv");

dotenv.config();

const fixPasswords = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const students = await User.find({ role: 'student' });
        console.log(`Found ${students.length} students. Resetting passwords safely...`);

        for (let student of students) {
            student.password = "123456";
            await student.save();
            console.log(`Reset password for ${student.email}`);
        }

        console.log("Passwords fixed for all students.");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}

fixPasswords();
