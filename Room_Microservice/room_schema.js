const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
    {
        _id: { type: String },
        roomNumber: { 
            type: String, 
            required: true, 
            unique: true, 
            uppercase: true, 
            trim: true 
        },
        roomName: { type: String, required: true, trim: true },
        building: { type: String, required: true, trim: true },
        floor: { type: Number, required: true, default: 1 },
        roomType: { 
            type: String, 
            enum: ['CLASSROOM', 'LAB', 'OFFICE', 'LIBRARY', 'SERVER_ROOM', 'AUDITORIUM'], 
            default: 'CLASSROOM' 
        },
        capacity: { type: Number, default: 30 },
        securityClearance: { 
            type: String, 
            enum: ['GENERAL', 'FACULTY_ONLY', 'RESTRICTED'], 
            default: 'GENERAL' 
        },
        isLocked: { type: Boolean, default: false },
        isEmergencyLocked: { type: Boolean, default: false },
        
        // Course & Classroom Management
        courseCode: { type: String, trim: true, uppercase: true, default: '' },
        courseTitle: { type: String, trim: true, default: '' },
        assignedFaculty: [
            {
                email: { type: String, lowercase: true, trim: true },
                name: { type: String, trim: true },
                assignedAt: { type: Date, default: Date.now }
            }
        ],
        enrolledStudents: [
            {
                email: { type: String, lowercase: true, trim: true },
                name: { type: String, trim: true },
                enrolledAt: { type: Date, default: Date.now }
            }
        ],
        pendingEnrollmentRequests: [
            {
                email: { type: String, lowercase: true, trim: true },
                name: { type: String, trim: true },
                requestedAt: { type: Date, default: Date.now }
            }
        ]
    },
    {
        timestamps: true,
        collection: 'rooms'
    }
);

module.exports = mongoose.model('Room', RoomSchema);
