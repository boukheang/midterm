const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const RoundRobinLoadBalancer = require('./load-balancer.js');

const PORT = process.env.PORT || 4000;
const LOG_FILE = process.env.LOG_FILE;
const JWT_SECRET = process.env.JWT_SECRET;

// Refuse to start without a real signing secret (no hard-coded fallback: anyone
// who read the source could otherwise forge admin tokens).
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('[API Gateway] JWT_SECRET is missing or shorter than 32 characters. Refusing to start.');
    process.exit(1);
}

// Upstream Target URLs
const REG_SERVICE_URL = process.env.REGISTRATION_SERVICE_URL || 'http://localhost:5001';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5002';
const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL || 'http://localhost:5003';
const PERM_SERVICE_URL = process.env.PERMISSION_SERVICE_URL || 'http://localhost:5004';
const EMERGENCY_SERVICE_URL = process.env.EMERGENCY_SERVICE_URL || 'http://localhost:5006';
const STUDENT_SERVICE_URL = process.env.STUDENT_SERVICE_URL || 'http://localhost:5007';
const TEACHER_SERVICE_URL = process.env.TEACHER_SERVICE_URL || 'http://localhost:5008';

// Access Log load balancer. In Kubernetes ACCESS_LOG_DNS points at a headless
// Service, so every Access Log pod is discovered automatically. Locally it falls
// back to the comma-separated ACCESS_LOG_INSTANCES list.
const accessLogLoadBalancer = new RoundRobinLoadBalancer('AccessLogService', {
    dnsHost: process.env.ACCESS_LOG_DNS || '',
    port: Number(process.env.ACCESS_LOG_PORT || 5005),
    staticInstances: (process.env.ACCESS_LOG_INSTANCES || 'http://localhost:5005,http://localhost:5015')
        .split(',').map(s => s.trim()).filter(Boolean).map(url => ({ url }))
});

const app = express();
app.disable('x-powered-by');

// Reuse TCP connections to upstream services instead of opening one per request.
const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    xfwd: true,
    agent: new http.Agent({ keepAlive: true, maxSockets: 100 })
});

app.use(cors());

// Basic security headers for the dashboard and API responses.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

// SECURITY: identity headers may only ever be set by the gateway itself (after
// verifying the JWT). Strip anything a client sent, otherwise a caller could
// simply send "X-User-Role: admin".
const IDENTITY_HEADERS = ['x-user-id', 'x-user-email', 'x-user-role', 'x-user-name', 'x-user-department'];
app.use((req, res, next) => {
    IDENTITY_HEADERS.forEach(h => delete req.headers[h]);
    next();
});

// Request Logging Middleware (also written to the shared log volume in Kubernetes).
// Kubernetes probe requests are skipped so they don't drown out real traffic.
app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/livez') return next();
    const message = `[API Gateway] ${new Date().toISOString()} | ${req.method} ${req.originalUrl}`;
    console.log(message);
    if (LOG_FILE) {
        fs.appendFile(LOG_FILE, `${message}\n`, err => {
            if (err) console.error(`[API Gateway] Unable to write request log: ${err.message}`);
        });
    }
    next();
});

// Learn pod names from the Access Log replicas for the live stats panel.
proxy.on('proxyRes', (proxyRes, req) => {
    if (req.lbTargetUrl) {
        accessLogLoadBalancer.recordInstanceName(req.lbTargetUrl, proxyRes.headers['x-served-by-instance']);
    }
});

proxy.on('error', (err, req, res) => {
    console.error('[API Gateway] Proxy Error:', err.message);
    if (!res.headersSent) {
        res.status(502).json({
            success: false,
            error: 'Bad Gateway',
            message: 'Target microservice is unavailable or unreachable.'
        });
    }
});

// Forward request to an upstream microservice with verified identity headers.
function forward(req, res, targetUrl, extraHeaders = {}, pathOverride = null) {
    req.url = pathOverride || req.originalUrl;

    if (req.user) {
        req.headers['x-user-id'] = String(req.user.id || '');
        req.headers['x-user-email'] = String(req.user.email || '');
        req.headers['x-user-role'] = String(req.user.role || '');
        req.headers['x-user-name'] = encodeURIComponent(String(req.user.name || ''));
        req.headers['x-user-department'] = encodeURIComponent(String(req.user.department || ''));
    }

    Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));
    proxy.web(req, res, { target: targetUrl });
}

// ====================================================================
// AUTHENTICATION & RBAC MIDDLEWARES
// ====================================================================

function readBearerToken(req) {
    const parts = String(req.headers.authorization || '').split(' ');
    return parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;
}

/** Verify JWT Bearer Token (required). */
function authToken(req, res, next) {
    if (!req.headers.authorization) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Please send token. Bearer token is required in Authorization header.'
        });
    }
    const token = readBearerToken(req);
    if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized', message: "Invalid token format. Expected: 'Bearer <token>'" });
    }
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Forbidden', message: 'Invalid or expired token.' });
        }
        req.user = decoded;
        next();
    });
}

/** Attach the user if a valid token is present, but do not require one. */
function optionalAuth(req, res, next) {
    const token = readBearerToken(req);
    if (!token) return next();
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
        if (!err) req.user = decoded;
        next();
    });
}

/** Role-Based Access Control (RBAC) middleware. */
function authRole(roles) {
    const allowed = (Array.isArray(roles) ? roles : [roles]).map(r => r.toLowerCase());
    return (req, res, next) => {
        const userRole = String((req.user && req.user.role) || '').toLowerCase();
        if (!userRole) {
            return res.status(403).json({ success: false, error: 'Forbidden', message: 'User role information is missing from token.' });
        }
        if (!allowed.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized',
                message: `Access denied. Role '${req.user.role}' is unauthorized for this endpoint. Required role(s): [${allowed.join(', ')}]`
            });
        }
        next();
    };
}

/**
 * Builds a route handler from an ordered rule table. The first rule whose method
 * and path match decides which roles are allowed; `defaultRoles` applies otherwise.
 * This replaces the long chains of if-statements per service.
 */
function routeByRules(rules, defaultRoles, handler) {
    return (req, res) => {
        const p = req.path.toLowerCase();
        const rule = rules.find(r => (!r.method || r.method === req.method) && r.match(p));
        const roles = rule ? rule.roles : defaultRoles;
        return authRole(roles)(req, res, () => handler(req, res));
    };
}

const ALL_ROLES = ['admin', 'faculty', 'student'];
const endsWith = suffix => p => p.endsWith(suffix);
const includes = part => p => p.includes(part);

// ====================================================================
// GATEWAY UTILITY ENDPOINTS
// ====================================================================

app.get('/livez', (req, res) => res.status(200).json({ status: 'ALIVE' }));

app.get('/health', (req, res) => {
    return res.status(200).json({
        service: 'API Gateway Microservice',
        status: 'UP',
        port: PORT,
        pod: process.env.POD_NAME || undefined,
        upstreamServices: {
            registration: REG_SERVICE_URL,
            authentication: AUTH_SERVICE_URL,
            roomManagement: ROOM_SERVICE_URL,
            accessPermission: PERM_SERVICE_URL,
            emergencyAlert: EMERGENCY_SERVICE_URL,
            student: STUDENT_SERVICE_URL,
            teacher: TEACHER_SERVICE_URL,
            accessLogLoadBalancedPool: accessLogLoadBalancer.instances.map(i => ({ name: i.name, url: i.url }))
        },
        timestamp: new Date().toISOString()
    });
});

app.get('/api/gateway/load-balancer-stats', authToken, authRole(['admin']), (req, res) => {
    return res.status(200).json({ success: true, stats: accessLogLoadBalancer.getStats() });
});

// ====================================================================
// PUBLIC AUTHENTICATION & REGISTRATION ROUTES
// ====================================================================

// Registration is public for students/faculty. If an admin token is sent, the
// Registration service may also create admin accounts.
app.use(['/reg', '/api/auth/register'], optionalAuth, (req, res) => forward(req, res, REG_SERVICE_URL));

app.use(['/login', '/api/auth/login', '/api/auth/verify'], (req, res) => forward(req, res, AUTH_SERVICE_URL));

// ====================================================================
// ROOM & PERMISSION MANAGEMENT
// ====================================================================

const toRooms = (req, res) => forward(req, res, ROOM_SERVICE_URL);
app.use('/api/rooms', authToken, routeByRules([
    { method: 'POST', match: endsWith('/request-enrollment'), roles: ['student'] },
    { method: 'POST', match: p => ['/approve-enrollment', '/reject-enrollment', '/remove-student'].some(s => p.endsWith(s)), roles: ['admin', 'faculty'] },
    { method: 'PATCH', match: endsWith('/toggle-lock'), roles: ['admin', 'faculty'] },
    // Everything else that writes (create/update/delete rooms, assign faculty,
    // direct enrollment, emergency set-lockdown) is admin only.
    { method: 'POST', match: () => true, roles: ['admin'] },
    { method: 'PUT', match: () => true, roles: ['admin'] },
    { method: 'PATCH', match: () => true, roles: ['admin'] },
    { method: 'DELETE', match: () => true, roles: ['admin'] }
], ALL_ROLES, toRooms));

// Permission APIs (including /check) are admin only - matching the Permission service.
app.use('/api/permissions', authToken, authRole(['admin']), (req, res) => forward(req, res, PERM_SERVICE_URL));

// ====================================================================
// STUDENT & TEACHER MICROSERVICES
// ====================================================================

app.use('/api/students', authToken, authRole(['student']), (req, res) => forward(req, res, STUDENT_SERVICE_URL));
app.use('/api/teachers', authToken, authRole(['faculty']), (req, res) => forward(req, res, TEACHER_SERVICE_URL));

// ====================================================================
// ACCESS LOG (LOAD BALANCED) & EMERGENCY ALERT
// ====================================================================

function toAccessLogPool(req, res) {
    let target;
    try {
        target = accessLogLoadBalancer.getNextTarget();
    } catch (err) {
        return res.status(503).json({ success: false, error: 'Service Unavailable', message: 'No Access Log replicas are ready.' });
    }
    req.lbTargetUrl = target.url;
    forward(req, res, target.url, {
        'X-Load-Balanced-By': 'API-Gateway-RoundRobin',
        'X-Upstream-Target': target.url,
        'X-Served-By-Instance': target.name,
        'X-Served-By-Port': String(target.port)
    });
}

app.use('/api/logs', authToken, routeByRules([
    { method: 'POST', match: includes('/swipe'), roles: ALL_ROLES },
    // The Access Log service additionally restricts non-admins to their own history.
    { method: 'GET', match: includes('/user/'), roles: ALL_ROLES }
], ['admin'], toAccessLogPool));

const toAlerts = (req, res) => forward(req, res, EMERGENCY_SERVICE_URL);
app.use('/api/alerts', authToken, routeByRules([
    { method: 'POST', match: includes('/report'), roles: ALL_ROLES },
    { method: 'GET', match: includes('/active'), roles: ALL_ROLES }
], ['admin'], toAlerts));

// ====================================================================
// ADMIN USER MANAGEMENT (-> Registration Service)
// ====================================================================

app.use(['/api/admin', '/admin'], authToken, authRole(['admin']), (req, res) => {
    const upstreamPath = req.originalUrl.replace(/^\/(api\/)?admin/, '') || '/';
    forward(req, res, REG_SERVICE_URL, {}, upstreamPath);
});

// ====================================================================
// STATIC CONSOLE & LIVE DASHBOARD
// ====================================================================
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));
app.get(['/', '/dashboard'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 Catch-All
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} does not exist on API Gateway.`
    });
});

app.listen(PORT, () => {
    console.log('=======================================================');
    console.log(`API Gateway Service is running on PORT: ${PORT}`);
    console.log(`Access Log pool mode: ${accessLogLoadBalancer.dnsHost ? `Kubernetes DNS (${accessLogLoadBalancer.dnsHost})` : 'static'}`);
    accessLogLoadBalancer.instances.forEach((inst, idx) => console.log(`  [Instance ${idx + 1}] ${inst.url}`));
    console.log('=======================================================');
});

module.exports = app;
