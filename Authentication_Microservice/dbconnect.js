const mongoose = require('mongoose');
require('dotenv').config();

// Database Connection URL
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart_campus_access_db';

const clientOptions = {
    serverSelectionTimeoutMS: 5000,
    autoIndex: true
};

async function connectDB() {
    // Retry until MongoDB is reachable. This is useful during container startup
    // and avoids silently giving up after a temporary connection failure.
    while (true) {
        try {
            await mongoose.connect(MONGO_URI, clientOptions);
            console.log('[Authentication Service] Connected to MongoDB.');
            return;
        } catch (err) {
            console.error('[Authentication Service] MongoDB connection failed; retrying in 5 seconds:', err.message);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

connectDB();

mongoose.connection.on('disconnected', () => {
    console.warn('[Authentication Service] MongoDB disconnected. Attempting reconnect...');
});

mongoose.connection.on('error', (err) => {
    console.error(`[Authentication Service] MongoDB error: ${err.message}`);
});

module.exports = mongoose;

