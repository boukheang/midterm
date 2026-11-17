const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
require('dotenv').config();

const { connectDB } = require('../shared/db');
const { registerHealthRoutes, getIdentity, requireRole, generateId, containsInsensitive, startServer } = require('../shared/service');
const { User: UserModel, ROLES } = require('../shared/models')(mongoose);

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 5001;
const SALT_ROUNDS = 10;
// Roles anyone may choose when signing up publicly. Admin accounts can only be
// created by an existing admin (or seeded from the Kubernetes Secret at startup).
const PUBLIC_ROLES = ['student', 'faculty'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

connectDB(mongoose, 'Registration Service');
registerHealthRoutes(app, mongoose, { service: 'Registration Microservice', port: PORT });

function newCardId() {
    return `CARD-${Math.floor(100000 + Math.random() * 900000)}`;
}

function publicUser(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        phone: user.phone,
        cardId: user.cardId,
        createdAt: user.createdAt
    };
}

/**
 * Validates a registration payload. `callerRole` is the role of the authenticated
 * caller (from the gateway), or '' for an anonymous public sign-up.
 */
function validateRegistration(body, callerRole) {
    const { name, firstname, email, password, role = 'student' } = body || {};
    const fullName = String(name || firstname || '').trim();
    const normalizedRole = String(role).toLowerCase().trim();
    const normalizedEmail = String(email || '').toLowerCase().trim();

    if (!fullName || !normalizedEmail || !password) {
        return { error: "Missing required fields: 'name' (or 'firstname'), 'email', and 'password' are required.", status: 400 };
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
        return { error: 'Email address is not valid.', status: 400 };
    }
    if (typeof password !== 'string' || password.length < 8) {
        return { error: 'Password must contain at least 8 characters.', status: 400 };
    }
    if (!ROLES.includes(normalizedRole)) {
        return { error: `Invalid role '${role}'. Allowed roles are: ${ROLES.join(', ')}`, status: 400 };
    }
    if (!PUBLIC_ROLES.includes(normalizedRole) && callerRole !== 'admin') {
        return { error: 'Only an administrator can create admin accounts.', status: 403 };
    }
    return { fullName, normalizedEmail, normalizedRole };
}

// ----------------------------------------------------
// USER REGISTRATION API (Handles /reg and /api/auth/register)
// ----------------------------------------------------
async function handleRegistration(req, res) {
    try {
        const caller = getIdentity(req);
        const check = validateRegistration(req.body, caller.role);
        if (check.error) {
            return res.status(check.status).json({ success: false, message: check.error });
        }

        const { department = 'General Studies', mobile, phone, cardId, password } = req.body;

        if (await UserModel.exists({ email: check.normalizedEmail })) {
            return res.status(409).json({ success: false, message: 'Email is already registered. Please login or use a different email.' });
        }

        const newUser = await UserModel.create({
            _id: generateId('USR'),
            name: check.fullName,
            email: check.normalizedEmail,
            password: await bcrypt.hash(password, SALT_ROUNDS),
            role: check.normalizedRole,
            department,
            phone: phone || mobile || '',
            cardId: cardId || newCardId(),
            isActive: true
        });

        console.log(`[Registration Service] User created: ${newUser.email} [${newUser.role}] ID: ${newUser._id}`);
        return res.status(201).json({ success: true, message: 'User registered successfully', user: publicUser(newUser) });
    } catch (err) {
        console.error('[Registration Service] Registration error:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error during registration.' });
    }
}

app.post('/reg', handleRegistration);
app.post('/api/auth/register', handleRegistration);

// ====================================================================
// ADMIN-ONLY USER MANAGEMENT (reached via the gateway's /api/admin/* route)
// ====================================================================
app.use(['/users', '/api/auth/batch-register'], requireRole('admin'));

// Bulk import. Every user must have a password of at least 8 characters
// (the old shared default password has been removed).
app.post('/api/auth/batch-register', async (req, res) => {
    try {
        const { users } = req.body;
        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ success: false, message: "Please provide an array of users under 'users' key." });
        }
        if (users.length > 500) {
            return res.status(400).json({ success: false, message: 'A maximum of 500 users can be imported at once.' });
        }

        const results = [];
        for (const u of users) {
            const check = validateRegistration(u, 'admin');
            if (check.error) {
                results.push({ email: u && u.email, status: 'FAILED', error: check.error });
                continue;
            }
            try {
                if (await UserModel.exists({ email: check.normalizedEmail })) {
                    results.push({ email: check.normalizedEmail, status: 'SKIPPED', reason: 'Email already exists' });
                    continue;
                }
                const created = await UserModel.create({
                    _id: generateId('USR'),
                    name: check.fullName,
                    email: check.normalizedEmail,
                    password: await bcrypt.hash(u.password, SALT_ROUNDS),
                    role: check.normalizedRole,
                    department: u.department || 'General Studies',
                    phone: u.phone || u.mobile || '',
                    cardId: u.cardId || newCardId(),
                    isActive: true
                });
                results.push({ email: created.email, status: 'CREATED', id: created._id, cardId: created.cardId });
            } catch (userErr) {
                results.push({ email: check.normalizedEmail, status: 'FAILED', error: userErr.message });
            }
        }

        return res.status(201).json({ success: true, message: `Batch registration completed. Processed ${results.length} records.`, results });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error processing batch registration.' });
    }
});

app.get('/users', async (req, res) => {
    try {
        const { role, department } = req.query;
        const filter = {};
        if (role) filter.role = String(role).toLowerCase();
        if (department) filter.department = containsInsensitive(department);

        const users = await UserModel.find(filter).select('-password').lean();
        return res.status(200).json({ success: true, totalUsers: users.length, users });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error retrieving users.' });
    }
});

app.get('/users/card/:cardId', async (req, res) => {
    try {
        const user = await UserModel.findOne({ cardId: req.params.cardId }).select('-password').lean();
        if (!user) return res.status(404).json({ success: false, message: 'Card ID not found' });
        return res.status(200).json({ success: true, user });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error retrieving user.' });
    }
});

app.get('/users/:id', async (req, res) => {
    try {
        const user = await UserModel.findById(req.params.id).select('-password').lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        return res.status(200).json({ success: true, user });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error retrieving user.' });
    }
});

app.delete('/users/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase().trim();
        if (email === req.identity.email) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own admin account.' });
        }
        const deleted = await UserModel.findOneAndDelete({ email });
        if (!deleted) return res.status(404).json({ success: false, message: 'User not found to delete' });
        return res.status(200).json({ success: true, message: `User ${deleted.email} deleted successfully.` });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error deleting user.' });
    }
});

// ----------------------------------------------------
// BOOTSTRAP ADMIN
// Public sign-up can no longer create admins, so the first admin comes from the
// ADMIN_EMAIL / ADMIN_PASSWORD values in the Kubernetes Secret. Runs once the DB
// is connected and only creates the account if that email does not exist yet.
// ----------------------------------------------------
async function seedAdminAccount() {
    const email = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        console.log('[Registration Service] ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin bootstrap.');
        return;
    }
    try {
        if (await UserModel.exists({ email })) return;
        await UserModel.create({
            _id: generateId('USR'),
            name: process.env.ADMIN_NAME || 'Campus Security Admin',
            email,
            password: await bcrypt.hash(password, SALT_ROUNDS),
            role: 'admin',
            department: 'Security',
            cardId: newCardId(),
            isActive: true
        });
        console.log(`[Registration Service] Bootstrap admin account created: ${email}`);
    } catch (err) {
        // Another replica may have created it at the same moment (duplicate key) - that's fine.
        if (err.code !== 11000) console.error('[Registration Service] Admin bootstrap failed:', err.message);
    }
}
mongoose.connection.once('connected', seedAdminAccount);

startServer(app, PORT, 'Registration Service');

module.exports = app;
