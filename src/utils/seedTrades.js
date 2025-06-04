import Trade from '../models/Trade.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const seedTrades = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const user = await User.findOne({ email: 'user@example.com' });
    if (!user) {
      console.log('No test user found');
      return;
    }

    const trades = [
      {
        userId: user._id,
        name: 'Swift Trade',
        amount: 50,
        profit: 720,
        status: 'paused',
        progress: 100,
        active: false
      },
      {
        userId: user._id,
        name: 'Fast Trade',
        amount: 75,
        profit: 900,
        status: 'terminated',
        progress: 100,
        active: false
      },
      {
        userId: user._id,
        name: 'Quick Trade',
        amount: 100,
        profit: 1200,
        status: 'in-progress',
        progress: 37,
        active: true
      },
      {
        userId: user._id,
        name: 'Steady Trade',
        amount: 150,
        profit: 1800,
        status: 'completed',
        progress: 100,
        active: false
      }
    ];

    await Trade.deleteMany({ userId: user._id });
    await Trade.insertMany(trades);

    console.log('Trade data seeded successfully');
    process.exit();
  } catch (err) {
    console.error('Trade seeding error:', err);
    process.exit(1);
  }
};

seedTrades();