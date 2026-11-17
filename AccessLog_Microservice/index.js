const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const { connectDB } = require('../shared/db');
const { registerHealthRoutes, requireRole, generateId, clampInt, startServer } = require('../shared/service');
const { evaluatePermissionWindow } = require('../shared/access-rules');
const AccessLogModel = require('./access_log_schema.js');

const app = express();
app.use(express.json({ limit: '100kb' }));

const PORT = process.env.PORT || 5005;
// In Kubernetes this is the pod name (injected via the Downward API), so the
// dashboard shows exactly which replica served each swipe.
const INSTANCE_NAME = process.env.POD_NAME || process.env.INSTANCE_NAME || `AccessLog-Instance-${PORT}`;

connectDB(mongoose, `Access Log Service ${INSTANCE_NAME}`);
const db = mongoose;

// Inject load-balancing identification headers on every response
app.use((req, res, next) => {
    res.setHeader('X-Served-By-Instance', INSTANCE_NAME);
    res.setHeader('X-Served-By-Port', PORT.toString());
    next();
});

registerHealthRoutes(app, mongoose, { service: 'Access Log & Swipe Microservice', instanceName: INSTANCE_NAME, port: PORT });

// Every log API requires an identity forwarded by the API Gateway.
app.use('/api/logs', requireRole('admin', 'faculty', 'student'));

const sameEmail = email => entry => String(entry.email || '').toLowerCase() === email;

/**
 * Decides whether a door opens. Order of checks:
 *   1. Room emergency lockdown / physical lock  -> DENIED
 *   2. Admin                                   -> GRANTED (master override)
 *   3. Faculty assigned to the classroom        -> GRANTED
 *   4. Student enrolled in the classroom        -> GRANTED
 *   5. Explicit access permission (days/hours)  -> GRANTED or DENIED with reason
 *   6. GENERAL room with no assigned instructor -> GRANTED (open space)
 *   otherwise                                   -> DENIED
 */
async function decideAccess({ email, userId, role, roomNumber, roomId }) {
    const roomLookup = String(roomNumber || roomId || '').replace(/^:/, '').trim().toUpperCase();
    const room = await db.connection.collection('rooms').findOne({
        $or: [{ roomNumber: roomLookup }, { _id: roomId || roomLookup }, { _id: roomLookup }]
    });

    if (room && room.isEmergencyLocked) return { status: 'DENIED', reason: 'CAMPUS_EMERGENCY_LOCKDOWN', room };
    if (room && room.isLocked) return { status: 'DENIED', reason: 'ROOM_PHYSICALLY_LOCKED', room };
    if (role === 'admin') return { status: 'GRANTED', reason: null, room };

    if (room && role === 'faculty' && (room.assignedFaculty || []).some(sameEmail(email))) {
        return { status: 'GRANTED', reason: null, room };
    }
    if (room && role === 'student' && (room.enrolledStudents || []).some(sameEmail(email))) {
        return { status: 'GRANTED', reason: null, room };
    }

    const resolvedRoomId = room ? room._id : (roomId || roomLookup);
    const permission = await db.connection.collection('access_permissions').findOne({
        isActive: true,
        $or: [
            { userEmail: email, roomNumber: roomLookup },
            { userEmail: email, roomId: resolvedRoomId },
            ...(userId ? [{ userId, roomId: resolvedRoomId }] : [])
        ]
    });

    if (permission) {
        const decision = evaluatePermissionWindow(permission);
        return decision.allowed
            ? { status: 'GRANTED', reason: null, room }
            : { status: 'DENIED', reason: decision.reason, room };
    }

    if (room && room.securityClearance === 'GENERAL' && (!room.assignedFaculty || room.assignedFaculty.length === 0)) {
        return { status: 'GRANTED', reason: null, room };
    }
    if (!room) return { status: 'DENIED', reason: 'NO_PERMISSION_GRANTED', room };
    return { status: 'DENIED', reason: role === 'student' ? 'STUDENT_NOT_ENROLLED_IN_CLASS' : 'FACULTY_NOT_ASSIGNED_TO_ROOM', room };
}

// ----------------------------------------------------
// PROCESS DOOR SWIPE / BADGE SCAN API
// POST /api/logs/swipe
// Students & faculty always swipe as themselves (identity comes from the JWT via
// the gateway). Admins may simulate a swipe for another user by passing
// userEmail / userRole in the body (badge simulator).
// ----------------------------------------------------
app.post('/api/logs/swipe', async (req, res) => {
    try {
        const caller = req.identity;
        const body = req.body || {};
        const { roomId, roomNumber, building = 'Main Campus' } = body;

        if (!roomId && !roomNumber) {
            return res.status(400).json({ success: false, message: 'Room identifier (roomNumber or roomId) is required.' });
        }

        const simulating = caller.role === 'admin' && body.userEmail &&
            String(body.userEmail).toLowerCase().trim() !== caller.email;
        const email = simulating ? String(body.userEmail).toLowerCase().trim() : caller.email;
        const role = simulating ? String(body.userRole || 'student').toLowerCase().trim() : caller.role;
        const userId = simulating ? String(body.userId || email) : (caller.id || email);

        if (!['admin', 'faculty', 'student'].includes(role)) {
            return res.status(400).json({ success: false, message: 'userRole must be admin, faculty or student.' });
        }

        let decision;
        try {
            decision = await decideAccess({ email, userId, role, roomNumber, roomId });
        } catch (checkErr) {
            console.warn(`[${INSTANCE_NAME}] Access check failed:`, checkErr.message);
            decision = { status: 'DENIED', reason: 'PERMISSION_CHECK_ERROR', room: null };
        }

        const { status, reason: denialReason, room } = decision;
        const logEntry = await AccessLogModel.create({
            _id: generateId('SWIPE'),
            userId,
            userEmail: email,
            userRole: role,
            roomId: room ? room._id : String(roomId || roomNumber),
            roomNumber: room ? room.roomNumber : String(roomNumber || roomId).toUpperCase().trim(),
            building: room ? room.building : building,
            status,
            denialReason,
            servedByInstance: INSTANCE_NAME,
            swipeTimestamp: new Date()
        });

        console.log(`[${INSTANCE_NAME}] Swipe Logged: ${logEntry._id} -> [${status}] (${denialReason || 'OK'}) by ${email}`);

        return res.status(200).json({
            success: true,
            accessDecision: status,
            doorUnlocked: status === 'GRANTED',
            message: status === 'GRANTED' ? 'Door unlocked. Access granted.' : `Access denied: ${denialReason}`,
            log: {
                id: logEntry._id,
                userEmail: logEntry.userEmail,
                roomNumber: logEntry.roomNumber,
                status: logEntry.status,
                denialReason: logEntry.denialReason,
                timestamp: logEntry.swipeTimestamp,
                servedBy: INSTANCE_NAME
            }
        });
    } catch (err) {
        console.error(`[${INSTANCE_NAME}] Swipe processing error:`, err.message);
        return res.status(500).json({ success: false, message: 'Error processing swipe' });
    }
});

// ----------------------------------------------------
// QUERY ALL ACCESS LOGS (Admin Audit)
// GET /api/logs?status=...&roomNumber=...&userEmail=...&limit=...
// ----------------------------------------------------
app.get('/api/logs', requireRole('admin'), async (req, res) => {
    try {
        const { status, roomNumber, userEmail, userRole } = req.query;
        const limit = clampInt(req.query.limit, 100, 1, 1000);
        const filter = {};

        if (status) filter.status = status.toUpperCase();
        if (roomNumber) filter.roomNumber = roomNumber.toUpperCase();
        if (userEmail) filter.userEmail = userEmail.toLowerCase();
        if (userRole) filter.userRole = userRole.toLowerCase();

        const logs = await AccessLogModel.find(filter)
            .sort({ swipeTimestamp: -1 })
            .limit(limit)
            .lean();

        return res.status(200).json({
            success: true,
            totalLogs: logs.length,
            servedBy: INSTANCE_NAME,
            logs
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error retrieving logs"
        });
    }
});

// ----------------------------------------------------
// QUERY LOGS FOR A SPECIFIC USER (Own History / Admin)
// GET /api/logs/user/:userId
// ----------------------------------------------------
app.get('/api/logs/user/:userId', async (req, res) => {
    try {
        const param = String(req.params.userId).trim();
        const caller = req.identity;
        // Students and faculty may only read their own swipe history.
        if (caller.role !== 'admin' && param.toLowerCase() !== caller.email && param !== caller.id) {
            return res.status(403).json({ success: false, message: 'You can only view your own access history.' });
        }
        const logs = await AccessLogModel.find({
            $or: [{ userId: param }, { userEmail: param.toLowerCase() }]
        })
        .sort({ swipeTimestamp: -1 })
        .limit(50)
        .lean();

        return res.status(200).json({
            success: true,
            totalEntries: logs.length,
            servedBy: INSTANCE_NAME,
            logs
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error retrieving user logs"
        });
    }
});

// ----------------------------------------------------
// SECURITY AUDIT SUMMARY STATISTICS (Admin Dashboard)
// GET /api/logs/stats/summary
// ----------------------------------------------------
app.get('/api/logs/stats/summary', requireRole('admin'), async (req, res) => {
    try {
        // Run the five queries in parallel instead of one after another.
        const [totalSwipes, totalGranted, totalDenied, denialBreakdown, mostAccessedRooms] = await Promise.all([
            AccessLogModel.countDocuments(),
            AccessLogModel.countDocuments({ status: 'GRANTED' }),
            AccessLogModel.countDocuments({ status: 'DENIED' }),
            AccessLogModel.aggregate([
                { $match: { status: 'DENIED' } },
                { $group: { _id: '$denialReason', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            AccessLogModel.aggregate([
                { $group: { _id: '$roomNumber', count: { $sum: 1 }, granted: { $sum: { $cond: [{ $eq: ['$status', 'GRANTED'] }, 1, 0] } } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ])
        ]);

        return res.status(200).json({
            success: true,
            servedBy: INSTANCE_NAME,
            statistics: {
                totalSwipes,
                totalGranted,
                totalDenied,
                approvalRate: totalSwipes > 0 ? `${((totalGranted / totalSwipes) * 100).toFixed(1)}%` : '0%',
                denialRate: totalSwipes > 0 ? `${((totalDenied / totalSwipes) * 100).toFixed(1)}%` : '0%',
                denialBreakdown,
                mostAccessedRooms
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error calculating statistics"
        });
    }
});

// ----------------------------------------------------
// ARCHIVE / CLEANUP LOGS (Admin)
// DELETE /api/logs/cleanup
// ----------------------------------------------------
app.delete('/api/logs/cleanup', requireRole('admin'), async (req, res) => {
    try {
        const olderThanDays = clampInt((req.body || {}).olderThanDays, 90, 1, 3650);
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

        const result = await AccessLogModel.deleteMany({
            swipeTimestamp: { $lt: cutoffDate }
        });

        return res.status(200).json({
            success: true,
            message: `Cleaned up ${result.deletedCount} log records older than ${olderThanDays} days.`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error cleaning up logs"
        });
    }
});

// Start Express Server
startServer(app, PORT, INSTANCE_NAME);

module.exports = app;
