const express = require('express');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(express.json());

const db = require('./dbconnect.js');
const UserModel = require('./user_schema.js');
const PermissionModel = require('./permission_schema.js');

const PORT = process.env.PORT || 5008;

// ----------------------------------------------------
// Gateway Authentication
// The API Gateway must verify JWT and forward these headers.
// Block direct external access to this microservice.
// ----------------------------------------------------
function requireFaculty(req, res, next) {
    const email = String(req.headers['x-user-email'] || '')
        .trim()
        .toLowerCase();

    const role = String(req.headers['x-user-role'] || '')
        .trim()
        .toLowerCase();

    if (!email || !role) {
        return res.status(401).json({
            success: false,
            message: 'Missing authenticated identity from API Gateway'
        });
    }

    if (role !== 'faculty') {
        return res.status(403).json({
            success: false,
            message: 'Only faculty members can access this service'
        });
    }

    req.userEmail = email;
    next();
}

// ----------------------------------------------------
// Health Check API
// ----------------------------------------------------
app.get('/health', (req, res) => {
    return res.status(200).json({
        service: 'Teacher Microservice',
        status: 'UP',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// ----------------------------------------------------
// GET /user_info
// Retrieve the authenticated faculty member's information
// ----------------------------------------------------
app.get('/api/teachers/user_info', requireFaculty, async (req, res) => {
    try {
        const user = await UserModel.findOne({
            email: req.userEmail,
            role: 'faculty'
        }).select(
            '_id name email role department phone cardId isActive createdAt updatedAt'
        ).lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Faculty member not found'
            });
        }

        return res.status(200).json({
            success: true,
            user
        });
    } catch (err) {
        console.error('[Teacher] User info error:', err.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve faculty information'
        });
    }
});

// ----------------------------------------------------
// PUT /update_info
// Update only name, password, and phone
// ----------------------------------------------------
app.put('/api/teachers/update_info', requireFaculty, async (req, res) => {
    try {
        const { name, password, phone } = req.body;
        const updates = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Name must be a non-empty string'
                });
            }

            updates.name = name.trim();
        }

        if (password !== undefined) {
            if (typeof password !== 'string' || password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must contain at least 8 characters'
                });
            }

            updates.password = await bcrypt.hash(password, 12);
        }

        if (phone !== undefined) {
            if (typeof phone !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Phone must be a string'
                });
            }

            updates.phone = phone.trim();
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Provide name, password, or phone to update'
            });
        }

        const user = await UserModel.findOneAndUpdate(
            {
                email: req.userEmail,
                role: 'faculty',
                isActive: true
            },
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Faculty member not found or inactive'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Faculty information updated successfully',
            user
        });
    } catch (err) {
        console.error('[Teacher] Update error:', err.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to update faculty information'
        });
    }
});

// ----------------------------------------------------
// GET /room_schedule
// Retrieve the authenticated faculty member's active permissions
// ----------------------------------------------------
app.get('/api/teachers/room_schedule', requireFaculty, async (req, res) => {
    try {
        const now = new Date();

        const schedules = await PermissionModel.find({
            userEmail: req.userEmail,
            userRole: 'faculty',
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now }
        }).select(
            'roomId roomNumber allowedDays startTime endTime validFrom validUntil isActive'
        ).lean();

        return res.status(200).json({
            success: true,
            count: schedules.length,
            schedules
        });
    } catch (err) {
        console.error('[Teacher] Room schedule error:', err.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve room schedule'
        });
    }
});

// ----------------------------------------------------
// Start Express Server
// ----------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Teacher Service] Running on PORT: ${PORT}`);
});

module.exports = app;