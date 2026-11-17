/**
 * Shared route logic for the Student and Teacher microservices.
 *
 * Both are still separate microservices (own image, Deployment and Service), but
 * their endpoints were ~95% identical copies. Each service now calls
 * registerPortal() with its own role/paths, so a fix only has to be made once.
 *
 * Dependencies (express, bcrypt, mongoose) are passed in by the service because
 * shared/ has no node_modules of its own.
 */
const { requireRole } = require('./service');

const PROFILE_FIELDS = '_id name email role department phone cardId isActive createdAt updatedAt';

/**
 * @param {object} deps    { app, express, bcrypt, mongoose }
 * @param {object} portal  { basePath, role, label, rosterField, logTag }
 *   rosterField: room field listing this role's members
 *                ('enrolledStudents' for students, 'assignedFaculty' for teachers)
 */
function registerPortal({ app, express, bcrypt, mongoose }, { basePath, role, label, rosterField, logTag }) {
    const { User: UserModel, AccessPermission: PermissionModel } = require('./models')(mongoose);
    const router = express.Router();
    router.use(requireRole(role));

    // GET /user_info - the authenticated user's own profile
    router.get('/user_info', async (req, res) => {
        try {
            const user = await UserModel.findOne({ email: req.identity.email, role }).select(PROFILE_FIELDS).lean();
            if (!user) return res.status(404).json({ success: false, message: `${label} not found` });
            return res.status(200).json({ success: true, user });
        } catch (err) {
            console.error(`[${logTag}] User info error:`, err.message);
            return res.status(500).json({ success: false, message: `Failed to retrieve ${label.toLowerCase()} information` });
        }
    });

    // PUT /update_info - update only name, password and phone
    router.put('/update_info', async (req, res) => {
        try {
            const { name, password, phone } = req.body || {};
            const updates = {};

            if (name !== undefined) {
                if (typeof name !== 'string' || !name.trim()) {
                    return res.status(400).json({ success: false, message: 'Name must be a non-empty string' });
                }
                updates.name = name.trim();
            }
            if (password !== undefined) {
                if (typeof password !== 'string' || password.length < 8) {
                    return res.status(400).json({ success: false, message: 'Password must contain at least 8 characters' });
                }
                updates.password = await bcrypt.hash(password, 10);
            }
            if (phone !== undefined) {
                if (typeof phone !== 'string') {
                    return res.status(400).json({ success: false, message: 'Phone must be a string' });
                }
                updates.phone = phone.trim();
            }
            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ success: false, message: 'Provide name, password, or phone to update' });
            }

            const user = await UserModel.findOneAndUpdate(
                { email: req.identity.email, role, isActive: true },
                { $set: updates },
                { new: true, runValidators: true }
            ).select(PROFILE_FIELDS).lean();

            if (!user) return res.status(404).json({ success: false, message: `${label} not found or inactive` });
            return res.status(200).json({ success: true, message: `${label} information updated successfully`, user });
        } catch (err) {
            console.error(`[${logTag}] Update error:`, err.message);
            return res.status(500).json({ success: false, message: `Failed to update ${label.toLowerCase()} information` });
        }
    });

    // GET /room_schedule - explicit room permissions plus the classrooms the user is
    // enrolled in (students) or teaches (faculty). Both grant door access.
    router.get('/room_schedule', async (req, res) => {
        try {
            const now = new Date();
            const email = req.identity.email;

            const [schedules, classrooms] = await Promise.all([
                PermissionModel.find({
                    userEmail: email,
                    userRole: role,
                    isActive: true,
                    validFrom: { $lte: now },
                    validUntil: { $gte: now }
                }).select('roomId roomNumber allowedDays startTime endTime validFrom validUntil isActive').lean(),
                mongoose.connection.collection('rooms')
                    .find({ [`${rosterField}.email`]: email })
                    .project({ roomNumber: 1, roomName: 1, building: 1, courseCode: 1, courseTitle: 1, isLocked: 1, isEmergencyLocked: 1 })
                    .toArray()
            ]);

            return res.status(200).json({ success: true, count: schedules.length, schedules, classrooms });
        } catch (err) {
            console.error(`[${logTag}] Room schedule error:`, err.message);
            return res.status(500).json({ success: false, message: 'Failed to retrieve room schedule' });
        }
    });

    app.use(basePath, router);
}

module.exports = { registerPortal };
