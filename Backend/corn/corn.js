import User from "../models/user.model.js"
import {generatePresignedUrl} from "../controller/user.controller.js"
import cron from 'node-cron';
cron.schedule('0 * * * *', async () => {
    try {
      const users = await User.find({ profileImg: { $exists: true } });
      for (const user of users) {
        const newUrl = await generatePresignedUrl(user.profileImg);
        user.profileImg = newUrl;
        await user.save();
      }
      console.log('Updated profile images for all users');
    } catch (error) {
      console.error('Error in cron job:', error.message);
    }
  });