const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log("Connected to MongoDB for final user cleanup...");
    
    // Exact emails we want to keep
    const keepEmails = [
        'admin@gmail.com',
        'divya965517@gmail.com',
        'gurusinnakkalai@gmail.com'
    ];

    // Delete everything else
    await User.deleteMany({ email: { $nin: keepEmails } });

    const count = await User.countDocuments();
    console.log('Cleaned extra floating legacy accounts. Remaining user count: ' + count);
    process.exit(0);
});
