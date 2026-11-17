/**
 * Smart Campus Access Control System - Automated Verification Script
 * Based on test.md specifications
 * Run with: node run_tests.js
 */
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
// Bootstrap admin (seeded by the Registration service from the Kubernetes Secret).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@campus.edu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password123!';

function makeRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const reqHeaders = { ...headers };
        let bodyData = null;

        if (body) {
            bodyData = JSON.stringify(body);
            reqHeaders['Content-Type'] = 'application/json';
            reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
        }

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: reqHeaders,
            timeout: 10000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });

        if (bodyData) {
            req.write(bodyData);
        }
        req.end();
    });
}

async function runAllTests() {
    console.log('='.repeat(70));
    console.log('SMART CAMPUS ACCESS CONTROL - AUTOMATED VERIFICATION SUITE');
    console.log(`Target Gateway: ${BASE_URL}`);
    console.log('='.repeat(70));

    let passedCount = 0;
    let failedCount = 0;

    function assert(name, condition, details = '') {
        if (condition) {
            console.log(`[PASS] ${name}`);
            if (details) console.log(`       ${details}`);
            passedCount++;
        } else {
            console.error(`[FAIL] ${name}`);
            if (details) console.error(`       ${details}`);
            failedCount++;
        }
    }

    try {
        console.log('\n--- Checking API Gateway Health ---');
        let gatewayReady = false;
        for (let i = 0; i < 30; i++) {
            try {
                const health = await makeRequest('GET', '/health');
                if (health.status === 200) {
                    console.log('API Gateway is UP and healthy.');
                    gatewayReady = true;
                    break;
                }
            } catch (err) {}
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!gatewayReady) {
            throw new Error('API Gateway at ' + BASE_URL + ' is not reachable. Run scripts/deploy.ps1 (Kubernetes) or set BASE_URL.');
        }

        // 1. Registration
        console.log('\n' + '='.repeat(70));
        console.log('1. TEST REGISTRATION');
        console.log('='.repeat(70));

        const testFacultyEmail = `faculty_${Date.now()}@campus.edu`;
        const regRes = await makeRequest('POST', '/reg', {
            name: "Faculty Tester",
            email: testFacultyEmail,
            password: "Password123!",
            role: "faculty",
            department: "Engineering"
        });

        assert('1.1 Public Registration Status Code is 201', regRes.status === 201, `Status: ${regRes.status}`);
        assert('1.1 Registration Response Structure',
            regRes.body.success === true && regRes.body.user && regRes.body.user.role === 'faculty',
            `User ID: ${regRes.body.user ? regRes.body.user.id : 'N/A'}`
        );

        const adminSelfReg = await makeRequest('POST', '/reg', {
            name: "Intruder",
            email: `intruder_${Date.now()}@campus.edu`,
            password: "Password123!",
            role: "admin"
        });
        assert('1.2 Public sign-up cannot create an admin (403)', adminSelfReg.status === 403, `Status: ${adminSelfReg.status}`);

        // 2. Login
        console.log('\n' + '='.repeat(70));
        console.log('2. TEST LOGIN & JWT TOKEN');
        console.log('='.repeat(70));

        const loginRes = await makeRequest('POST', '/login', {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            role: "admin"
        });

        assert('2. Login Status Code is 200', loginRes.status === 200, `Status: ${loginRes.status}`);
        assert('2. Login Token Received', 
            loginRes.body.success === true && typeof loginRes.body.token === 'string',
            `Token: ${loginRes.body.token ? loginRes.body.token.slice(0, 32) + '...' : 'none'}`
        );

        const adminToken = loginRes.body.token;

        // 3. Room Management
        console.log('\n' + '='.repeat(70));
        console.log('3. TEST ROOM MANAGEMENT (WITH TOKEN)');
        console.log('='.repeat(70));

        const testRoomNum = `ENG-${Math.floor(100 + Math.random() * 899)}`;
        const createRoomRes = await makeRequest('POST', '/api/rooms', {
            roomNumber: testRoomNum,
            roomName: "Software Engineering Lab",
            building: "Engineering Hall",
            floor: 3,
            roomType: "LAB",
            capacity: 50,
            securityClearance: "GENERAL"
        }, {
            Authorization: `Bearer ${adminToken}`
        });

        assert('3. Create Room Status Code is 201', createRoomRes.status === 201, `Status: ${createRoomRes.status}`);
        assert('3. Room Data Persisted',
            createRoomRes.body.success === true && createRoomRes.body.room && createRoomRes.body.room.roomNumber === testRoomNum,
            `Created roomNumber: ${testRoomNum}`
        );

        // 4. Negative Cases
        console.log('\n' + '='.repeat(70));
        console.log('4. TEST NEGATIVE CASES (REQUIRED SCREENSHOTS)');
        console.log('='.repeat(70));

        // 4.1 Wrong Password
        const wrongPwRes = await makeRequest('POST', '/login', {
            email: ADMIN_EMAIL,
            password: "WRONG_PASSWORD_123",
            role: "admin"
        });
        assert('4.1 Wrong Password returns 401', wrongPwRes.status === 401, `Status: ${wrongPwRes.status}`);
        assert('4.1 Message: Invalid email, password, or role', 
            wrongPwRes.body.message === "Invalid email, password, or role",
            `Body: ${JSON.stringify(wrongPwRes.body)}`
        );

        // 4.2 Missing Token
        const missingTokenRes = await makeRequest('GET', '/api/rooms');
        assert('4.2 Missing Token returns 401', missingTokenRes.status === 401, `Status: ${missingTokenRes.status}`);
        assert('4.2 Error: Unauthorized (Bearer token required)',
            missingTokenRes.body.error === "Unauthorized" && missingTokenRes.body.message.includes("Please send token"),
            `Message: ${missingTokenRes.body.message}`
        );

        // 4.3 Invalid Token
        const invalidTokenRes = await makeRequest('GET', '/api/rooms', null, { Authorization: "Bearer fake123" });
        assert('4.3 Invalid Token returns 403 Forbidden', invalidTokenRes.status === 403, `Status: ${invalidTokenRes.status}`);
        assert('4.3 Error: Forbidden (Invalid or expired token)',
            invalidTokenRes.body.error === "Forbidden" && invalidTokenRes.body.message.includes("Invalid or expired token"),
            `Message: ${invalidTokenRes.body.message}`
        );

        // 4.4 RBAC Restriction
        const studentEmail = `student_${Date.now()}@campus.edu`;
        await makeRequest('POST', '/reg', {
            name: "Test Student",
            email: studentEmail,
            password: "Password123!",
            role: "student",
            department: "Computer Science"
        });
        const studentLogin = await makeRequest('POST', '/login', {
            email: studentEmail,
            password: "Password123!",
            role: "student"
        });
        const studentToken = studentLogin.body.token;

        const unauthRoomRes = await makeRequest('POST', '/api/rooms', {
            roomNumber: "ENG-999",
            roomName: "Unauthorized Room",
            building: "Engineering Hall"
        }, {
            Authorization: `Bearer ${studentToken}`
        });

        assert('4.4 Student creating room returns 403 Forbidden', unauthRoomRes.status === 403, `Status: ${unauthRoomRes.status}`);
        assert('4.4 Role student unauthorized message matches',
            unauthRoomRes.body.message && unauthRoomRes.body.message.includes("Role 'student' is unauthorized"),
            `Message: ${unauthRoomRes.body.message}`
        );

        // 5. Door Swipe & Round-Robin Load Balancer
        console.log('\n' + '='.repeat(70));
        console.log('5. TEST DOOR BADGE SWIPE & LOAD BALANCING');
        console.log('='.repeat(70));

        const swipePayload = {
            userId: "USR-1001",
            userEmail: studentEmail,
            userRole: "student",
            roomId: `ROOM-${testRoomNum}`,
            roomNumber: testRoomNum,
            building: "Engineering Hall"
        };

        const swipe1 = await makeRequest('POST', '/api/logs/swipe', swipePayload, {
            Authorization: `Bearer ${studentToken}`
        });

        assert('5.1 Swipe 1 Status Code is 200', swipe1.status === 200, `Status: ${swipe1.status}`);
        assert('5.1 Header X-Load-Balanced-By is API-Gateway-RoundRobin',
            swipe1.headers['x-load-balanced-by'] === 'API-Gateway-RoundRobin',
            `Got: ${swipe1.headers['x-load-balanced-by']}`
        );
        const inst1 = swipe1.headers['x-served-by-instance'];
        console.log(`       Request 1 routed to: ${inst1}`);

        const swipe2 = await makeRequest('POST', '/api/logs/swipe', swipePayload, {
            Authorization: `Bearer ${studentToken}`
        });

        assert('5.2 Swipe 2 Status Code is 200', swipe2.status === 200, `Status: ${swipe2.status}`);
        const inst2 = swipe2.headers['x-served-by-instance'];
        console.log(`       Request 2 routed to: ${inst2}`);

        assert('5.3 Round-Robin Alternation Verified',
            inst1 !== inst2,
            `Instance 1: ${inst1} -> Instance 2: ${inst2}`
        );

        // 6. Security regression tests
        console.log('\n' + '='.repeat(70));
        console.log('6. TEST SECURITY FIXES');
        console.log('='.repeat(70));

        const facultyLogin = await makeRequest('POST', '/login', { email: testFacultyEmail, password: "Password123!" });
        const facultyToken = facultyLogin.body.token;

        const spoofed = await makeRequest('GET', '/api/permissions', null, {
            Authorization: `Bearer ${studentToken}`,
            'X-User-Role': 'admin',
            'X-User-Email': ADMIN_EMAIL
        });
        assert('6.1 Forged X-User-Role header is ignored (403)', spoofed.status === 403, `Status: ${spoofed.status}`);

        const facultyLockdown = await makeRequest('PATCH', '/api/rooms/emergency/set-lockdown',
            { building: 'ALL', emergencyLocked: true }, { Authorization: `Bearer ${facultyToken}` });
        assert('6.2 Faculty cannot trigger campus lockdown (403)', facultyLockdown.status === 403, `Status: ${facultyLockdown.status}`);

        const impersonate = await makeRequest('POST', '/api/logs/swipe',
            { userEmail: ADMIN_EMAIL, userRole: 'admin', roomNumber: testRoomNum }, { Authorization: `Bearer ${studentToken}` });
        assert('6.3 Student cannot swipe as someone else (logged as self)',
            impersonate.body.log && impersonate.body.log.userEmail === studentEmail,
            `Logged as: ${impersonate.body.log && impersonate.body.log.userEmail}`);

        const otherLogs = await makeRequest('GET', `/api/logs/user/${encodeURIComponent(ADMIN_EMAIL)}`, null, { Authorization: `Bearer ${studentToken}` });
        assert("6.4 Student cannot read another user's access history (403)", otherLogs.status === 403, `Status: ${otherLogs.status}`);

        // 7. Classroom enrollment controls door access
        console.log('\n' + '='.repeat(70));
        console.log('7. TEST CLASSROOM ENROLLMENT DOOR ACCESS');
        console.log('='.repeat(70));

        const adminAuth = { Authorization: `Bearer ${adminToken}` };
        await makeRequest('POST', `/api/rooms/${testRoomNum}/assign-faculty`, { email: testFacultyEmail, name: 'Faculty Tester' }, adminAuth);

        const beforeEnroll = await makeRequest('POST', '/api/logs/swipe', { roomNumber: testRoomNum }, { Authorization: `Bearer ${studentToken}` });
        assert('7.1 Not-enrolled student is DENIED', beforeEnroll.body.accessDecision === 'DENIED',
            `Decision: ${beforeEnroll.body.accessDecision} (${beforeEnroll.body.log && beforeEnroll.body.log.denialReason})`);

        const facultySwipe = await makeRequest('POST', '/api/logs/swipe', { roomNumber: testRoomNum }, { Authorization: `Bearer ${facultyToken}` });
        assert('7.2 Assigned faculty is GRANTED', facultySwipe.body.accessDecision === 'GRANTED', `Decision: ${facultySwipe.body.accessDecision}`);

        await makeRequest('POST', `/api/rooms/${testRoomNum}/enroll-student`, { email: studentEmail }, adminAuth);
        const afterEnroll = await makeRequest('POST', '/api/logs/swipe', { roomNumber: testRoomNum }, { Authorization: `Bearer ${studentToken}` });
        assert('7.3 Enrolled student is GRANTED', afterEnroll.body.accessDecision === 'GRANTED',
            `Decision: ${afterEnroll.body.accessDecision} (${afterEnroll.body.log && afterEnroll.body.log.denialReason})`);

        const schedule = await makeRequest('GET', '/api/students/room_schedule', null, { Authorization: `Bearer ${studentToken}` });
        assert('7.4 Student service lists the enrolled classroom',
            schedule.status === 200 && Array.isArray(schedule.body.classrooms) && schedule.body.classrooms.some(c => c.roomNumber === testRoomNum),
            `Status: ${schedule.status}`);

        const teacherInfo = await makeRequest('GET', '/api/teachers/user_info', null, { Authorization: `Bearer ${facultyToken}` });
        assert('7.5 Teacher service returns the faculty profile',
            teacherInfo.status === 200 && teacherInfo.body.user && teacherInfo.body.user.email === testFacultyEmail,
            `Status: ${teacherInfo.status}`);

        // 8. Overnight permission windows
        console.log('\n' + '='.repeat(70));
        console.log('8. TEST OVERNIGHT PERMISSION WINDOW (22:00-02:00, Friday)');
        console.log('='.repeat(70));

        const grant = await makeRequest('POST', '/api/permissions/grant', {
            userId: 'USR-NIGHT', userEmail: studentEmail, userRole: 'student',
            roomId: `ROOM-${testRoomNum}`, roomNumber: testRoomNum,
            allowedDays: ['Friday'], startTime: '22:00', endTime: '02:00'
        }, adminAuth);
        assert('8.1 Overnight grant accepted', grant.status === 201 || grant.status === 200, `Status: ${grant.status} ${grant.body.message || ''}`);

        const check = ts => makeRequest('POST', '/api/permissions/check',
            { userEmail: studentEmail, userRole: 'student', roomNumber: testRoomNum, timestamp: ts }, adminAuth);
        const friLate = await check('2026-11-20T23:00:00');
        assert('8.2 Friday 23:00 allowed', friLate.body.allowed === true, `Reason: ${friLate.body.reason}`);
        const satEarly = await check('2026-11-21T01:30:00');
        assert('8.3 Saturday 01:30 allowed (still Friday night)', satEarly.body.allowed === true, `Reason: ${satEarly.body.reason}`);
        const satLate = await check('2026-11-21T03:00:00');
        assert('8.4 Saturday 03:00 denied', satLate.body.allowed === false, `Reason: ${satLate.body.reason}`);
        if (grant.body.permission) {
            await makeRequest('DELETE', `/api/permissions/${grant.body.permission._id}`, null, adminAuth);
        }

        await makeRequest('DELETE', `/api/rooms/${testRoomNum}`, null, adminAuth);

        // 9. Lifting a lockdown resolves every lockdown alert it covers
        console.log('\n' + '='.repeat(70));
        console.log('9. TEST LOCKDOWN LIFT');
        console.log('='.repeat(70));

        await makeRequest('POST', '/api/alerts/lockdown', { building: 'Test Hall A', description: 'Test lockdown A' }, adminAuth);
        await makeRequest('POST', '/api/alerts/lockdown', { building: 'Test Hall B', description: 'Test lockdown B' }, adminAuth);
        await makeRequest('POST', '/api/alerts/lockdown', { building: 'ALL', description: 'Test campus lockdown' }, adminAuth);

        const partialLift = await makeRequest('POST', '/api/alerts/lift', { building: 'Test Hall A' }, adminAuth);
        assert('9.1 One building cannot reopen during a campus lockdown (409)', partialLift.status === 409, `Status: ${partialLift.status}`);

        const fullLift = await makeRequest('POST', '/api/alerts/lift', { building: 'ALL' }, adminAuth);
        assert('9.2 Lift ALL resolves all 3 lockdown alerts', fullLift.status === 200 && fullLift.body.resolvedCount >= 3,
            `Resolved: ${fullLift.body.resolvedCount}`);

        const stillActive = await makeRequest('GET', '/api/alerts/active', null, adminAuth);
        const activeLockdowns = (stillActive.body.alerts || []).filter(a => ['CAMPUS_LOCKDOWN', 'BUILDING_LOCKDOWN'].includes(a.alertType));
        assert('9.3 No lockdown alerts left active', activeLockdowns.length === 0, `Active lockdowns: ${activeLockdowns.length}`);

        console.log('\n' + '='.repeat(70));
        console.log(`VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
        console.log('='.repeat(70));

        process.exit(failedCount === 0 ? 0 : 1);

    } catch (err) {
        console.error('[FATAL ERROR]', err.message);
        process.exit(1);
    }
}

runAllTests();
