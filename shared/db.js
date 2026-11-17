/**
 * Shared MongoDB connection helper used by every database-backed microservice.
 *
 * The service passes in its own `mongoose` instance so this file never has to
 * `require('mongoose')` itself (each service keeps its own node_modules).
 */
const DEFAULT_URI = 'mongodb://localhost:27017/smart_campus_access_db';

function connectDB(mongoose, serviceName) {
    const uri = process.env.MONGO_URI || DEFAULT_URI;
    const tag = `[${serviceName}]`;

    if (!process.env.MONGO_URI) {
        console.warn(`${tag} MONGO_URI not set; using local default ${DEFAULT_URI}`);
    }

    mongoose.connection.on('disconnected', () => console.warn(`${tag} MongoDB disconnected. Mongoose will reconnect automatically.`));
    mongoose.connection.on('error', err => console.error(`${tag} MongoDB error: ${err.message}`));

    // Retry the *initial* connection until MongoDB is reachable. Kubernetes keeps the
    // pod out of the Service (readiness probe fails) until this succeeds.
    (async function connectWithRetry() {
        while (true) {
            try {
                await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: true });
                console.log(`${tag} Connected to MongoDB.`);
                return;
            } catch (err) {
                console.error(`${tag} MongoDB connection failed; retrying in 5 seconds: ${err.message}`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    })();

    return mongoose;
}

function isDbReady(mongoose) {
    return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDbReady };
