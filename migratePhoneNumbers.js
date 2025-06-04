import mongoose from 'mongoose';
import env from './env.js';
import User from './././src/models/User.js'; // Adjust path as needed
import dotenv from 'dotenv';



// Load environment variables
dotenv.config();

// Verify the connection URI exists
if (!process.env.MONGO_URI) {
  console.error('Error: MONGO_URI is not defined in .env file');
  process.exit(1);
}

console.log('Connecting to:', process.env.MONGO_URI);

const migratePhoneNumbers = async () => {
  let connection;
  try {
    // Connect to MongoDB
    connection = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log('✅ Connected to MongoDB successfully');
    
    // Find all users with phoneNumber but empty mobile
    const usersToUpdate = await User.find({
      phoneNumber: { $exists: true, $ne: '', $type: 'string' },
      $or: [
        { mobile: { $exists: false } },
        { mobile: '' }
      ]
    });

    console.log(`📊 Found ${usersToUpdate.length} users to migrate`);

    // Process in batches
    const batchSize = 100;
    let processedCount = 0;
    
    for (let i = 0; i < usersToUpdate.length; i += batchSize) {
      const batch = usersToUpdate.slice(i, i + batchSize);
      
      const bulkOps = batch.map(user => {
        if (!user.phoneNumber) {
          console.warn(`⚠️ User ${user._id} has no phoneNumber despite query`);
          return null;
        }
        
        return {
          updateOne: {
            filter: { _id: user._id },
            update: {
              $set: {
                mobile: user.phoneNumber.replace(/\D/g, '').replace(/^\+/, ''),
                updatedAt: new Date()
              }
            }
          }
        };
      }).filter(op => op !== null);

      if (bulkOps.length > 0) {
        const result = await User.bulkWrite(bulkOps);
        processedCount += bulkOps.length;
        console.log(`🔄 Processed ${processedCount}/${usersToUpdate.length} users`);
      }
    }

    console.log('🎉 Migration completed successfully');
    console.log(`✔ Updated ${processedCount} user records`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
    process.exit(0);
  }
};

migratePhoneNumbers();