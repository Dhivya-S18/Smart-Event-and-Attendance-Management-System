const mongoose = require("mongoose");
const User = require("./models/User");
const Club = require("./models/Club");
const Association = require("./models/Association");
const dotenv = require("dotenv");

dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    try {
      console.log("Connected to DB, running backfill...");
      const users = await User.find({ role: { $ne: 'admin' } });
      let updatedCount = 0;

      for (const user of users) {
        let entityName = null;

        // Check Clubs
        const club = await Club.findOne({
          $or: [
            { members: user._id },
            { studentCoordinators: user._id },
            { staffCoordinators: user._id },
            { hods: user._id }
          ]
        });

        if (club) {
          entityName = club.clubName;
          user.clubId = club._id;
        }

        // Check Associations
        if (!entityName) {
          const association = await Association.findOne({
            $or: [
              { studentCoordinators: user._id },
              { staffCoordinators: user._id },
              { hodId: user._id }
            ]
          });

          if (association) {
            entityName = association.name;
            user.associationId = association._id;
          }
        }

        // Only update if we found a match and it differs
        if (entityName && user.clubName !== entityName) {
          user.clubName = entityName;
          await user.save();
          console.log(`Updated user ${user.email} -> ${entityName}`);
          updatedCount++;
        }
      }

      console.log(`Backfill complete. Updated ${updatedCount} users.`);
    } catch (err) {
      console.error(err);
    } finally {
      process.exit(0);
    }
  });
