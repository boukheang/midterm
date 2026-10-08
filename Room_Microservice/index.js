const express = require('express');
require('dotenv').config();

const app = express();
app.use(express.json());

const db = require('./dbconnect.js');
const RoomModel = require('./room_schema.js');

const PORT = process.env.PORT || 5003;

function generateId(prefix = 'ROOM') {
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${Date.now().toString().slice(-4)}${rand}`;
}

/**
 * Universal room lookup helper that handles MongoDB _id, roomNumber,
 * and strips accidental leading colons (e.g. ':ENG-301' from Postman URL variables)
 */
function resolveRoomQuery(param) {
    if (!param) return {};
    const raw = param.toString().trim();
    const clean = raw.replace(/^:/, '').trim().toUpperCase();
    return {
        $or: [
            { _id: raw },
            { _id: clean },
            { roomNumber: raw },
            { roomNumber: clean },
            { roomNumber: raw.toUpperCase() }
        ]
    };
}

// ----------------------------------------------------
// Health Check API
// ----------------------------------------------------
app.get('/health', (req, res) => {
    return res.status(200).json({
        service: 'Room Management Microservice (Team Member 1)',
        status: 'UP',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// ----------------------------------------------------
// CREATE ROOM API (Admin)
// POST /api/rooms
// ----------------------------------------------------
app.post('/api/rooms', async (req, res) => {
    try {
        const {
            roomNumber,
            roomName,
            building,
            floor = 1,
            roomType = 'CLASSROOM',
            capacity = 30,
            securityClearance = 'GENERAL',
            courseCode = '',
            courseTitle = ''
        } = req.body;

        if (!roomNumber || !roomName || !building) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: roomNumber, roomName, and building are mandatory."
            });
        }

        const normalizedNumber = roomNumber.toString().replace(/^:/, '').toUpperCase().trim();

        // Check if room number already exists
        const existing = await RoomModel.findOne({ roomNumber: normalizedNumber });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Room with number '${normalizedNumber}' already exists.`
            });
        }

        const newRoom = new RoomModel({
            _id: generateId('ROOM'),
            roomNumber: normalizedNumber,
            roomName: roomName.trim(),
            building: building.trim(),
            floor: Number(floor),
            roomType: roomType.toUpperCase().trim(),
            capacity: Number(capacity),
            securityClearance: securityClearance.toUpperCase().trim(),
            isLocked: false,
            isEmergencyLocked: false,
            courseCode: courseCode.trim().toUpperCase(),
            courseTitle: courseTitle.trim(),
            assignedFaculty: [],
            enrolledStudents: [],
            pendingEnrollmentRequests: []
        });

        await newRoom.save();
        console.log(`[Room Service] Room created: ${newRoom.roomNumber} - ${newRoom.roomName}`);

        return res.status(201).json({
            success: true,
            message: "Room created successfully",
            room: newRoom
        });
    } catch (err) {
        console.error('[Room Service] Create error:', err);
        return res.status(500).json({
            success: false,
            message: err.message || "Error creating room"
        });
    }
});

// ----------------------------------------------------
// GET ALL ROOMS API (With Filters)
// GET /api/rooms?building=...&roomType=...&securityClearance=...
// ----------------------------------------------------
app.get('/api/rooms', async (req, res) => {
    try {
        const { building, roomType, securityClearance, isLocked, courseCode } = req.query;
        const filter = {};

        if (building) filter.building = new RegExp(building, 'i');
        if (roomType) filter.roomType = roomType.toUpperCase();
        if (securityClearance) filter.securityClearance = securityClearance.toUpperCase();
        if (isLocked !== undefined) filter.isLocked = isLocked === 'true';
        if (courseCode) filter.courseCode = new RegExp(courseCode, 'i');

        const rooms = await RoomModel.find(filter).sort({ building: 1, roomNumber: 1 });

        return res.status(200).json({
            success: true,
            totalRooms: rooms.length,
            rooms
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error fetching rooms"
        });
    }
});

// ----------------------------------------------------
// GET ROOM BY ID OR ROOM NUMBER
// GET /api/rooms/:id (Supports e.g. ENG-301 or :ENG-301 from Postman)
// ----------------------------------------------------
app.get('/api/rooms/:id', async (req, res) => {
    try {
        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);

        if (!room) {
            const cleanDisplay = req.params.id.toString().replace(/^:/, '');
            return res.status(404).json({
                success: false,
                message: `Room '${cleanDisplay}' not found.`
            });
        }

        return res.status(200).json({
            success: true,
            room
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error retrieving room"
        });
    }
});

// ----------------------------------------------------
// GET CLASSROOM ROSTER & ENROLLMENT STATUS
// GET /api/rooms/:id/roster
// ----------------------------------------------------
app.get('/api/rooms/:id/roster', async (req, res) => {
    try {
        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);

        if (!room) {
            const cleanDisplay = req.params.id.toString().replace(/^:/, '');
            return res.status(404).json({
                success: false,
                message: `Room '${cleanDisplay}' not found.`
            });
        }

        return res.status(200).json({
            success: true,
            roomNumber: room.roomNumber,
            roomName: room.roomName,
            building: room.building,
            capacity: room.capacity,
            courseCode: room.courseCode || 'N/A',
            courseTitle: room.courseTitle || room.roomName,
            isLocked: room.isLocked,
            assignedFaculty: room.assignedFaculty || [],
            enrolledStudents: room.enrolledStudents || [],
            pendingRequests: room.pendingEnrollmentRequests || [],
            stats: {
                totalFaculty: (room.assignedFaculty || []).length,
                totalEnrolled: (room.enrolledStudents || []).length,
                pendingCount: (room.pendingEnrollmentRequests || []).length,
                availableSeats: Math.max(0, room.capacity - (room.enrolledStudents || []).length)
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error fetching classroom roster"
        });
    }
});

// ----------------------------------------------------
// ASSIGN FACULTY (TEACHER) TO ROOM / COURSE (Admin)
// POST /api/rooms/:id/assign-faculty
// ----------------------------------------------------
app.post('/api/rooms/:id/assign-faculty', async (req, res) => {
    try {
        const { email, name, courseCode, courseTitle } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Faculty email is required."
            });
        }

        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: `Room '${req.params.id}' not found.`
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const facultyName = (name || normalizedEmail.split('@')[0]).trim();

        // Check if already assigned
        const alreadyAssigned = room.assignedFaculty.some(f => f.email === normalizedEmail);
        if (!alreadyAssigned) {
            room.assignedFaculty.push({
                email: normalizedEmail,
                name: facultyName,
                assignedAt: new Date()
            });
        }

        if (courseCode) room.courseCode = courseCode.trim().toUpperCase();
        if (courseTitle) room.courseTitle = courseTitle.trim();

        await room.save();
        console.log(`[Room Service] Faculty ${normalizedEmail} assigned to room ${room.roomNumber}`);

        return res.status(200).json({
            success: true,
            message: `Faculty '${facultyName}' (${normalizedEmail}) assigned to room ${room.roomNumber}.`,
            room
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error assigning faculty"
        });
    }
});

// ----------------------------------------------------
// REMOVE FACULTY FROM ROOM (Admin)
// POST /api/rooms/:id/remove-faculty
// ----------------------------------------------------
app.post('/api/rooms/:id/remove-faculty', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Faculty email is required." });
        }

        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);
        if (!room) {
            return res.status(404).json({ success: false, message: `Room '${req.params.id}' not found.` });
        }

        const normalizedEmail = email.toLowerCase().trim();
        room.assignedFaculty = room.assignedFaculty.filter(f => f.email !== normalizedEmail);
        await room.save();

        return res.status(200).json({
            success: true,
            message: `Faculty '${normalizedEmail}' removed from room ${room.roomNumber}.`,
            room
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error removing faculty"
        });
    }
});

// ----------------------------------------------------
// STUDENT REQUEST ENROLLMENT (Student / Admin)
// POST /api/rooms/:id/request-enrollment
// ----------------------------------------------------
app.post('/api/rooms/:id/request-enrollment', async (req, res) => {
    try {
        const callerEmail = req.headers['x-user-email'] || req.body.email;
        const studentName = req.body.name || req.headers['x-user-id'] || callerEmail;

        if (!callerEmail) {
            return res.status(400).json({
                success: false,
                message: "Student email is required (via token or request body)."
            });
        }

        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);
        if (!room) {
            return res.status(404).json({ success: false, message: `Room '${req.params.id}' not found.` });
        }

        const normalizedEmail = callerEmail.toLowerCase().trim();

        // Check if already enrolled
        if (room.enrolledStudents.some(s => s.email === normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: `You are already enrolled in ${room.roomNumber} (${room.roomName}).`
            });
        }

        // Check if request is already pending
        if (room.pendingEnrollmentRequests.some(r => r.email === normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: `Your enrollment request for ${room.roomNumber} is already pending teacher review.`
            });
        }

        // Check room capacity
        if (room.enrolledStudents.length >= room.capacity) {
            return res.status(400).json({
                success: false,
                message: `Classroom ${room.roomNumber} has reached its maximum capacity of ${room.capacity} students.`
            });
        }

        room.pendingEnrollmentRequests.push({
            email: normalizedEmail,
            name: studentName,
            requestedAt: new Date()
        });

        await room.save();
        console.log(`[Room Service] Student ${normalizedEmail} requested enrollment in ${room.roomNumber}`);

        return res.status(200).json({
            success: true,
            message: `Enrollment request submitted for ${room.roomNumber} (${room.courseTitle || room.roomName}). Awaiting faculty approval.`,
            roomNumber: room.roomNumber,
            pendingCount: room.pendingEnrollmentRequests.length
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error submitting enrollment request"
        });
    }
});

// ----------------------------------------------------
// APPROVE ENROLLMENT REQUEST (Faculty / Admin)
// POST /api/rooms/:id/approve-enrollment
// ----------------------------------------------------
app.post('/api/rooms/:id/approve-enrollment', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Student email to approve is required." });
        }

        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);
        if (!room) {
            return res.status(404).json({ success: false, message: `Room '${req.params.id}' not found.` });
        }

        const callerRole = (req.headers['x-user-role'] || '').toLowerCase();
        const callerEmail = (req.headers['x-user-email'] || '').toLowerCase();

        // If faculty, verify they teach this room
        if (callerRole === 'faculty') {
            const isAssigned = room.assignedFaculty.some(f => f.email === callerEmail);
            if (!isAssigned) {
                return res.status(403).json({
                    success: false,
                    message: `You are not assigned as an instructor for room ${room.roomNumber}. Only assigned teachers or admins can approve students.`
                });
            }
        }

        const normalizedEmail = email.toLowerCase().trim();
        const pendingIndex = room.pendingEnrollmentRequests.findIndex(r => r.email === normalizedEmail);

        let studentName = normalizedEmail.split('@')[0];
        if (pendingIndex !== -1) {
            studentName = room.pendingEnrollmentRequests[pendingIndex].name || studentName;
            room.pendingEnrollmentRequests.splice(pendingIndex, 1);
        }

        // Add to enrolled if not already
        if (!room.enrolledStudents.some(s => s.email === normalizedEmail)) {
            room.enrolledStudents.push({
                email: normalizedEmail,
                name: studentName,
                enrolledAt: new Date()
            });
        }

        await room.save();
        console.log(`[Room Service] Student ${normalizedEmail} approved for room ${room.roomNumber}`);

        return res.status(200).json({
            success: true,
            message: `Student '${normalizedEmail}' approved and successfully enrolled in ${room.roomNumber}. Badge swipe access granted!`,
            enrolledStudents: room.enrolledStudents,
            pendingRequests: room.pendingEnrollmentRequests
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error approving enrollment"
        });
    }
});

// ----------------------------------------------------
// REJECT ENROLLMENT REQUEST (Faculty / Admin)
// POST /api/rooms/:id/reject-enrollment
// ----------------------------------------------------
app.post('/api/rooms/:id/reject-enrollment', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Student email to reject is required." });
        }

        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);
        if (!room) {
            return res.status(404).json({ success: false, message: `Room '${req.params.id}' not found.` });
        }

        const callerRole = (req.headers['x-user-role'] || '').toLowerCase();
        const callerEmail = (req.headers['x-user-email'] || '').toLowerCase();

        // If faculty, verify they teach this room
        if (callerRole === 'faculty') {
            const isAssigned = room.assignedFaculty.some(f => f.email === callerEmail);
            if (!isAssigned) {
                return res.status(403).json({
                    success: false,
                    message: `You are not assigned as an instructor for room ${room.roomNumber}.`
                });
            }
        }

        const normalizedEmail = email.toLowerCase().trim();
        room.pendingEnrollmentRequests = room.pendingEnrollmentRequests.filter(r => r.email !== normalizedEmail);
        await room.save();

        return res.status(200).json({
            success: true,
            message: `Enrollment request for student '${normalizedEmail}' has been rejected.`,
            pendingRequests: room.pendingEnrollmentRequests
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error rejecting enrollment"
        });
    }
});

// ----------------------------------------------------
// DIRECT ENROLL STUDENT (Admin)
// POST /api/rooms/:id/enroll-student
// ----------------------------------------------------
app.post('/api/rooms/:id/enroll-student', async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Student email is required." });
        }

        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);
        if (!room) {
            return res.status(404).json({ success: false, message: `Room '${req.params.id}' not found.` });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const studentName = (name || normalizedEmail.split('@')[0]).trim();

        // Remove from pending if present
        room.pendingEnrollmentRequests = room.pendingEnrollmentRequests.filter(r => r.email !== normalizedEmail);

        // Add to enrolled if not present
        if (!room.enrolledStudents.some(s => s.email === normalizedEmail)) {
            room.enrolledStudents.push({
                email: normalizedEmail,
                name: studentName,
                enrolledAt: new Date()
            });
        }

        await room.save();

        return res.status(200).json({
            success: true,
            message: `Student '${normalizedEmail}' directly enrolled in ${room.roomNumber}.`,
            enrolledStudents: room.enrolledStudents
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error enrolling student"
        });
    }
});

// ----------------------------------------------------
// REMOVE STUDENT FROM CLASS (Admin / Faculty)
// POST /api/rooms/:id/remove-student
// ----------------------------------------------------
app.post('/api/rooms/:id/remove-student', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Student email is required." });
        }

        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);
        if (!room) {
            return res.status(404).json({ success: false, message: `Room '${req.params.id}' not found.` });
        }

        const callerRole = (req.headers['x-user-role'] || '').toLowerCase();
        const callerEmail = (req.headers['x-user-email'] || '').toLowerCase();

        if (callerRole === 'faculty') {
            const isAssigned = room.assignedFaculty.some(f => f.email === callerEmail);
            if (!isAssigned) {
                return res.status(403).json({
                    success: false,
                    message: `You are not assigned as an instructor for room ${room.roomNumber}.`
                });
            }
        }

        const normalizedEmail = email.toLowerCase().trim();
        room.enrolledStudents = room.enrolledStudents.filter(s => s.email !== normalizedEmail);
        await room.save();

        return res.status(200).json({
            success: true,
            message: `Student '${normalizedEmail}' removed from room ${room.roomNumber}.`,
            enrolledStudents: room.enrolledStudents
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error removing student"
        });
    }
});

// ----------------------------------------------------
// UPDATE ROOM API (Admin)
// PUT /api/rooms/:id
// ----------------------------------------------------
app.put('/api/rooms/:id', async (req, res) => {
    try {
        const query = resolveRoomQuery(req.params.id);
        const updateData = { ...req.body };

        if (updateData.roomNumber) updateData.roomNumber = updateData.roomNumber.toString().replace(/^:/, '').toUpperCase().trim();
        if (updateData.roomType) updateData.roomType = updateData.roomType.toUpperCase().trim();
        if (updateData.securityClearance) updateData.securityClearance = updateData.securityClearance.toUpperCase().trim();
        if (updateData.courseCode) updateData.courseCode = updateData.courseCode.toUpperCase().trim();

        const updatedRoom = await RoomModel.findOneAndUpdate(
            query,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedRoom) {
            const cleanDisplay = req.params.id.toString().replace(/^:/, '');
            return res.status(404).json({
                success: false,
                message: `Room '${cleanDisplay}' not found for update.`
            });
        }

        return res.status(200).json({
            success: true,
            message: "Room updated successfully",
            room: updatedRoom
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error updating room"
        });
    }
});

// ----------------------------------------------------
// TOGGLE ROOM LOCK STATUS (Admin / Assigned Faculty)
// PATCH /api/rooms/:id/toggle-lock
// ----------------------------------------------------
app.patch('/api/rooms/:id/toggle-lock', async (req, res) => {
    try {
        const query = resolveRoomQuery(req.params.id);
        const room = await RoomModel.findOne(query);

        if (!room) {
            const cleanDisplay = req.params.id.toString().replace(/^:/, '');
            return res.status(404).json({
                success: false,
                message: `Room '${cleanDisplay}' not found.`
            });
        }

        const callerRole = (req.headers['x-user-role'] || '').toLowerCase();
        const callerEmail = (req.headers['x-user-email'] || '').toLowerCase();

        // If faculty, verify assigned to this classroom
        if (callerRole === 'faculty') {
            const isAssigned = (room.assignedFaculty || []).some(f => f.email === callerEmail);
            if (!isAssigned) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Faculty member '${callerEmail}' is not assigned to classroom ${room.roomNumber}.`
                });
            }
        }

        const newState = req.body.isLocked !== undefined ? Boolean(req.body.isLocked) : !room.isLocked;
        room.isLocked = newState;
        await room.save();

        console.log(`[Room Service] Room ${room.roomNumber} lock status toggled to: ${room.isLocked}`);

        return res.status(200).json({
            success: true,
            message: `Room ${room.roomNumber} is now ${room.isLocked ? 'LOCKED' : 'UNLOCKED'}.`,
            room
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error toggling lock status"
        });
    }
});

// ----------------------------------------------------
// BATCH EMERGENCY LOCKDOWN TOGGLE (Internal Emergency Service)
// PATCH /api/rooms/emergency/set-lockdown
// ----------------------------------------------------
app.patch('/api/rooms/emergency/set-lockdown', async (req, res) => {
    try {
        const { building, emergencyLocked } = req.body;
        const query = {};
        if (building && building !== 'ALL') {
            query.building = new RegExp(`^${building}$`, 'i');
        }

        const update = { isEmergencyLocked: Boolean(emergencyLocked) };
        const result = await RoomModel.updateMany(query, { $set: update });

        return res.status(200).json({
            success: true,
            message: `Emergency lockdown ${emergencyLocked ? 'ACTIVATED' : 'LIFTED'} for ${result.modifiedCount} rooms.`,
            affectedRooms: result.modifiedCount
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error updating emergency lockdown state"
        });
    }
});

// ----------------------------------------------------
// DELETE ROOM API (Admin)
// DELETE /api/rooms/:id
// ----------------------------------------------------
app.delete('/api/rooms/:id', async (req, res) => {
    try {
        const query = resolveRoomQuery(req.params.id);
        const deleted = await RoomModel.findOneAndDelete(query);

        if (!deleted) {
            const cleanDisplay = req.params.id.toString().replace(/^:/, '');
            return res.status(404).json({
                success: false,
                message: `Room '${cleanDisplay}' not found to delete.`
            });
        }

        console.log(`[Room Service] Room deleted: ${deleted.roomNumber}`);

        return res.status(200).json({
            success: true,
            message: `Room ${deleted.roomNumber} (${deleted.roomName}) deleted successfully.`,
            deletedRoomId: deleted._id
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Error deleting room"
        });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`[Room Service] Running on PORT: ${PORT}`);
});

module.exports = app;
