require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const { connectDB } = require('../shared/db');
const { registerHealthRoutes, requireRole, generateId, startServer } = require('../shared/service');
const { evaluatePermissionWindow } = require('../shared/access-rules');
const { AccessPermission: PermissionModel } = require('../shared/models')(mongoose);

const app = express();
app.use(express.json({ limit: '100kb' }));

const PORT = process.env.PORT || 5004;

connectDB(mongoose, 'Permission Service');
registerHealthRoutes(app, mongoose, { service: 'Access Permission Microservice', port: PORT });

// ----------------------------------------------------
// ADMIN-ONLY AUTHORIZATION for every permission API.
// The API Gateway verifies the JWT and forwards X-User-* headers.
// ----------------------------------------------------
app.use('/api/permissions', requireRole('admin'), (req, res, next) => {
    req.admin = req.identity;
    next();
});

// ----------------------------------------------------
// GRANT OR UPDATE ROOM ACCESS PERMISSION
// POST /api/permissions/grant
// ADMIN ONLY
// ----------------------------------------------------

app.post('/api/permissions/grant', async (req, res) => {
    try {
        const {
            userId,
            userEmail,
            userRole = 'student',
            roomId,
            roomNumber,
            allowedDays = [
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday'
            ],
            startTime = '08:00',
            endTime = '20:00',
            validUntil
        } = req.body;

        if (!userId || !userEmail || !roomId || !roomNumber) {
            return res.status(400).json({
                success: false,
                message:
                    'userId, userEmail, roomId, and roomNumber are required.'
            });
        }

        const normalizedEmail = String(userEmail)
            .trim()
            .toLowerCase();

        const normalizedRoomNumber = String(roomNumber)
            .trim()
            .toUpperCase();

        const normalizedRole = String(userRole).trim().toLowerCase();

        if (!['admin', 'faculty', 'student'].includes(normalizedRole)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid userRole.'
            });
        }

        if (!Array.isArray(allowedDays) ||
            !allowedDays.every(day =>
                [
                    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
                    'Friday', 'Saturday', 'Sunday'
                ].includes(day)
            )) {
            return res.status(400).json({
                success: false,
                message: 'allowedDays must contain valid weekday names.'
            });
        }

        const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

        if (
            !timePattern.test(startTime) ||
            !timePattern.test(endTime) ||
            startTime === endTime
        ) {
            // startTime > endTime is allowed and means an overnight window (e.g. 22:00-02:00).
            return res.status(400).json({
                success: false,
                message: 'Invalid time range. Use HH:mm; startTime and endTime must differ (start later than end = overnight).'
            });
        }

        let expiration;

        if (validUntil !== undefined) {
            expiration = new Date(validUntil);

            if (Number.isNaN(expiration.getTime()) ||
                expiration <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'validUntil must be a future date.'
                });
            }
        } else {
            expiration = new Date(
                Date.now() + 365 * 24 * 60 * 60 * 1000
            );
        }

        let permission = await PermissionModel.findOne({
            userEmail: normalizedEmail,
            roomNumber: normalizedRoomNumber,
            isActive: true
        });

        if (permission) {
            permission.userId = String(userId).trim();
            permission.userRole = normalizedRole;
            permission.roomId = String(roomId).trim();
            permission.allowedDays = allowedDays;
            permission.startTime = startTime;
            permission.endTime = endTime;
            permission.validUntil = expiration;
            permission.grantedBy = req.admin.email;

            await permission.save();

            return res.status(200).json({
                success: true,
                message: 'Existing room permission updated.',
                permission
            });
        }

        permission = new PermissionModel({
            _id: generateId('PERM'),
            userId: String(userId).trim(),
            userEmail: normalizedEmail,
            userRole: normalizedRole,
            roomId: String(roomId).trim(),
            roomNumber: normalizedRoomNumber,
            allowedDays,
            startTime,
            endTime,
            validUntil: expiration,
            isActive: true,
            grantedBy: req.admin.email
        });

        await permission.save();

        return res.status(201).json({
            success: true,
            message: 'Room access permission granted.',
            permission
        });
    } catch (err) {
        console.error('[Permission Service] Grant error:', err);

        return res.status(500).json({
            success: false,
            message: 'Error granting permission.'
        });
    }
});

// ----------------------------------------------------
// VIEW ALL PERMISSIONS
// GET /api/permissions
// ADMIN ONLY
// ----------------------------------------------------

app.get('/api/permissions', async (req, res) => {
    try {
        const { userRole, roomNumber, isActive } = req.query;
        const filter = {};

        if (userRole) {
            filter.userRole = String(userRole).toLowerCase();
        }

        if (roomNumber) {
            filter.roomNumber = String(roomNumber).toUpperCase();
        }

        if (isActive !== undefined) {
            if (!['true', 'false'].includes(isActive)) {
                return res.status(400).json({
                    success: false,
                    message: 'isActive must be true or false.'
                });
            }

            filter.isActive = isActive === 'true';
        }

        const permissions = await PermissionModel.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            totalPermissions: permissions.length,
            permissions
        });
    } catch (err) {
        console.error('[Permission Service] List error:', err);

        return res.status(500).json({
            success: false,
            message: 'Error retrieving permissions.'
        });
    }
});

// ----------------------------------------------------
// VIEW PERMISSIONS FOR A USER
// GET /api/permissions/user/:userId
// ADMIN ONLY
// ----------------------------------------------------

app.get('/api/permissions/user/:userId', async (req, res) => {
    try {
        const param = req.params.userId.trim();

        const permissions = await PermissionModel.find({
            $or: [
                { userId: param },
                { userEmail: param.toLowerCase() }
            ],
            isActive: true
        }).lean();

        return res.status(200).json({
            success: true,
            totalPermissions: permissions.length,
            permissions
        });
    } catch (err) {
        console.error('[Permission Service] User lookup error:', err);

        return res.status(500).json({
            success: false,
            message: 'Error retrieving user permissions.'
        });
    }
});

// ----------------------------------------------------
// VIEW AUTHORIZED USERS FOR A ROOM
// GET /api/permissions/room/:roomId
// ADMIN ONLY
// ----------------------------------------------------

app.get('/api/permissions/room/:roomId', async (req, res) => {
    try {
        const param = req.params.roomId.trim();

        const permissions = await PermissionModel.find({
            $or: [
                { roomId: param },
                { roomNumber: param.toUpperCase() }
            ],
            isActive: true
        }).lean();

        return res.status(200).json({
            success: true,
            totalAuthorizedUsers: permissions.length,
            permissions
        });
    } catch (err) {
        console.error('[Permission Service] Room lookup error:', err);

        return res.status(500).json({
            success: false,
            message: 'Error retrieving room permissions.'
        });
    }
});

// ----------------------------------------------------
// EVALUATE ROOM ACCESS
// POST /api/permissions/check
// ADMIN ONLY (simulate a door decision for any user/time)
// ----------------------------------------------------

app.post('/api/permissions/check', async (req, res) => {
    try {
        const {
            userId,
            userEmail,
            userRole,
            roomId,
            roomNumber,
            timestamp
        } = req.body;

        if ((!userEmail && !userId) || (!roomNumber && !roomId)) {
            return res.status(400).json({
                allowed: false,
                reason: 'MISSING_FIELDS',
                message: 'Provide a user identifier and room identifier.'
            });
        }

        // Use the supplied time when testing, otherwise use current time.
        const now = timestamp ? new Date(timestamp) : new Date();

        if (Number.isNaN(now.getTime())) {
            return res.status(400).json({
                allowed: false,
                reason: 'INVALID_TIMESTAMP',
                message: 'timestamp must be a valid date.'
            });
        }

        // Admin override
        if (String(userRole || '').toLowerCase() === 'admin') {
            return res.status(200).json({
                allowed: true,
                reason: 'ADMIN_OVERRIDE',
                message: 'Administrator access granted.'
            });
        }

        const query = { isActive: true };

        if (userEmail) {
            query.userEmail = String(userEmail).trim().toLowerCase();
        } else {
            query.userId = String(userId).trim();
        }

        if (roomNumber) {
            query.roomNumber = String(roomNumber).trim().toUpperCase();
        } else {
            query.roomId = String(roomId).trim();
        }

        const permission = await PermissionModel.findOne(query);

        const decision = evaluatePermissionWindow(permission, now);
        if (!decision.allowed) {
            return res.status(200).json(decision);
        }

        return res.status(200).json({
            allowed: true,
            reason: 'AUTHORIZED',
            message: 'User is authorized for room access.',
            permissionId: permission._id
        });
    } catch (err) {
        console.error('[Permission Service] Check error:', err);

        return res.status(500).json({
            allowed: false,
            reason: 'EVALUATION_ERROR',
            message: 'Unable to evaluate permission.'
        });
    }
});

// ----------------------------------------------------
// REVOKE PERMISSION
// DELETE /api/permissions/:id
// ADMIN ONLY
// ----------------------------------------------------

app.delete('/api/permissions/:id', async (req, res) => {
    try {
        const deleted = await PermissionModel.findByIdAndDelete(
            req.params.id
        );

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Permission record not found.'
            });
        }

        console.log(
            `[Permission Service] Admin ${req.admin.email} revoked ` +
            `${deleted._id} (${deleted.userEmail} -> ${deleted.roomNumber})`
        );

        return res.status(200).json({
            success: true,
            message: 'Permission revoked successfully.',
            permissionId: deleted._id
        });
    } catch (err) {
        console.error('[Permission Service] Revoke error:', err);

        return res.status(500).json({
            success: false,
            message: 'Error revoking permission.'
        });
    }
});

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------

startServer(app, PORT, 'Permission Service');

module.exports = app;