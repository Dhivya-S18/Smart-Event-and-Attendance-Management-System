const mongoose = require("mongoose");
const seedClubs = require("./seed/seedClubs");
const dotenv = require("dotenv");

dotenv.config();

const runSeeder = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await seedClubs();
    console.log("Manual seeding trigger finished.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

runSeeder();
