const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
require('dotenv').config();

const { connectDB } = require('../shared/db');
const { registerHealthRoutes, startServer } = require('../shared/service');
const { User: UserModel } = require('../shared/models')(mongoose);

const app = express();
app.use(express.json({ limit: '100kb' }));

const PORT = process.env.PORT || 5002;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Refuse to start without a real signing secret: a hard-coded fallback would let
// anyone who has read the source code forge tokens.
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('[Authentication Service] JWT_SECRET is missing or shorter than 32 characters. Refusing to start.');
    process.exit(1);
}

connectDB(mongoose, 'Authentication Service');
registerHealthRoutes(app, mongoose, { service: 'Authentication Microservice', port: PORT });

// Pre-computed hash so a login for an unknown email takes the same time as a wrong
// password (prevents discovering which emails are registered by timing).
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-password', 10);
const INVALID = { success: false, message: 'Invalid email, password, or role' };

// ----------------------------------------------------
// LOGIN API (Handles /login and /api/auth/login)
// ----------------------------------------------------
async function handleLogin(req, res) {
    try {
        const { email, password, role } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required for login.' });
        }

        const query = { email: String(email).toLowerCase().trim() };
        if (role) query.role = String(role).toLowerCase().trim();

        const user = await UserModel.findOne(query);
        const passwordMatch = await bcrypt.compare(String(password), user ? user.password : DUMMY_HASH);

        if (!user || !passwordMatch) {
            return res.status(401).json(INVALID);
        }
        if (user.isActive === false) {
            return res.status(403).json({ success: false, message: 'Account is deactivated or suspended. Please contact campus security administration.' });
        }

        const userInfo = {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            department: user.department,
            cardId: user.cardId
        };
        const token = jwt.sign(userInfo, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        console.log(`[Authentication Service] Successful login for: ${user.email} [${user.role}]`);
        return res.status(200).json({ success: true, message: 'Login successful', token, user: userInfo });
    } catch (err) {
        console.error('[Authentication Service] Login error:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
    }
}

app.post('/login', handleLogin);
app.post('/api/auth/login', handleLogin);

// ----------------------------------------------------
// TOKEN VERIFICATION API
// ----------------------------------------------------
app.post('/api/auth/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.split(' ')[1]) || (req.body && req.body.token);

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token is required for verification.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token', error: err.message });
        }
        return res.status(200).json({ success: true, valid: true, user: decoded });
    });
});

startServer(app, PORT, 'Authentication Service');

module.exports = app;
