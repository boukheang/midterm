const mongoose = require('mongoose');
require('dotenv').config();

// Database Connection URL
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://vanpanhavanchhoeun_db_user:0Y2cnQcKNsdAa8Xx@cluster0.5fxh7yq.mongodb.net/UserData?appName=Cluster0";

const clientOptions = {
    serverSelectionTimeoutMS: 5000,
    autoIndex: true
};

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI, clientOptions);
        console.log(`[Emergency Alert Service] Connected successfully to MongoDB at: ${MONGO_URI.split('@').pop()}`);
    } catch (err) {
        console.error(`[Emergency Alert Service] MongoDB Connection Error: ${err.message}`);
    }
}

connectDB();

mongoose.connection.on('disconnected', () => {
    console.warn('[Emergency Alert Service] MongoDB disconnected. Attempting reconnect...');
});

mongoose.connection.on('error', (err) => {
    console.error(`[Emergency Alert Service] MongoDB error: ${err.message}`);
});

module.exports = mongoose;

