const mongoose = require("mongoose");
require("dotenv").config({ path: __dirname + "/.env" });

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/club-events", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    try {
      const User = require("./models/User");
      const Club = require("./models/Club");
      const Association = require("./models/Association");

      console.log("Looking for Ram Priya...");
      const users = await User.find({ name: /Ram Priya/i });
      if(users.length === 0) {
         console.log("Could not find Ram Priya by name. She might have used a different name or typo during registration.");
         process.exit(0);
      }
      
      // Grab any association or club
      let assoc = await Association.findOne();
      let club = await Club.findOne();
      
      if (!assoc && !club) {
         console.log("No associations or clubs exist in the system!");
         process.exit(0);
      }
      
      for(const u of users) {
         console.log("Force fixing:", u.email);
         if (assoc) {
           if(!assoc.studentCoordinators.includes(u._id)) {
              assoc.studentCoordinators.push(u._id);
              await assoc.save();
           }
           u.clubName = assoc.name;
           u.associationId = assoc._id;
         } else if (club) {
           if(!club.studentCoordinators.includes(u._id)) {
              club.studentCoordinators.push(u._id);
              await club.save();
           }
           u.clubName = club.clubName;
           u.clubId = club._id;
         }
         await u.save();
         console.log(`Successfully hard-linked ${u.email} to ${assoc ? assoc.name : club.clubName}`);
      }
    } catch(e) {
      console.log("Error:", e);
    }
    process.exit(0);
  });
