/**
 * Mongoose models shared by several services. Previously user_schema.js was copied
 * into 4 services and permission_schema.js into 3, which risked the copies drifting apart.
 *
 * Usage: const { User, AccessPermission } = require('../shared/models')(mongoose);
 */
module.exports = function buildModels(mongoose) {
    if (mongoose.models.User && mongoose.models.AccessPermission) {
        return { User: mongoose.models.User, AccessPermission: mongoose.models.AccessPermission };
    }

    const ROLES = ['admin', 'faculty', 'student'];

    const UserSchema = new mongoose.Schema(
        {
            _id: { type: String },
            name: { type: String, required: true, trim: true },
            email: { type: String, required: true, unique: true, lowercase: true, trim: true },
            password: { type: String, required: true },
            role: { type: String, enum: ROLES, default: 'student', required: true },
            department: { type: String, default: 'General Studies' },
            phone: { type: String, default: '' },
            cardId: { type: String, unique: true, sparse: true },
            isActive: { type: Boolean, default: true }
        },
        { timestamps: true, collection: 'users' }
    );

    const PermissionSchema = new mongoose.Schema(
        {
            _id: { type: String },
            userId: { type: String, required: true },
            userEmail: { type: String, required: true, lowercase: true, trim: true },
            userRole: { type: String, enum: ROLES, required: true },
            roomId: { type: String, required: true },
            roomNumber: { type: String, required: true, uppercase: true, trim: true },
            allowedDays: { type: [String], default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
            startTime: { type: String, default: '08:00' }, // HH:mm
            endTime: { type: String, default: '20:00' },   // HH:mm
            validFrom: { type: Date, default: Date.now },
            validUntil: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
            isActive: { type: Boolean, default: true },
            grantedBy: { type: String, default: 'SYSTEM_ADMIN' }
        },
        { timestamps: true, collection: 'access_permissions' }
    );
    PermissionSchema.index({ userId: 1, roomId: 1 });
    PermissionSchema.index({ userEmail: 1, roomNumber: 1 });

    return {
        User: mongoose.models.User || mongoose.model('User', UserSchema),
        AccessPermission: mongoose.models.AccessPermission || mongoose.model('AccessPermission', PermissionSchema),
        ROLES
    };
};
