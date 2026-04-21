const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");

dotenv.config();

const verifyPasswords = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const adminUser = await User.findOne({ role: 'admin' });
        
        if (adminUser) {
            console.log(`Admin email: ${adminUser.email}`);
            const isMatch = await adminUser.matchPassword('123456');
            console.log(`Admin password match for '123456': ${isMatch}`);
            console.log(`Hash stored: ${adminUser.password}`);
        }

        const hodUser = await User.findOne({ role: 'hod' });
        if (hodUser) {
            console.log(`HOD email: ${hodUser.email}`);
            const isMatch = await hodUser.matchPassword('123456');
            console.log(`HOD password match for '123456': ${isMatch}`);
        }

        const staffUser = await User.findOne({ role: 'staff' });
        if (staffUser) {
            console.log(`Staff email: ${staffUser.email}`);
            const isMatch = await staffUser.matchPassword('123456');
            console.log(`Staff password match for '123456': ${isMatch}`);
        }

        const student = await User.findOne({ email: 'codingclub.student1@college.edu' });
        if (student) {
            console.log(`Student email: ${student.email}`);
            const isMatch = await student.matchPassword('123456');
            console.log(`Student password match for '123456': ${isMatch}`);
        }

        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
verifyPasswords();
