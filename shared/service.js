/**
 * Shared helpers for every backend microservice:
 *  - health endpoints for Kubernetes probes
 *  - identity extraction from headers set by the API Gateway
 *  - role-based guards
 *  - small utilities (ids, safe regex)
 */
const { isDbReady } = require('./db');

/**
 * Registers:
 *   GET /livez  -> process is alive (Kubernetes livenessProbe). Never checks the DB,
 *                  so a MongoDB outage does not cause restart loops.
 *   GET /health -> ready to serve traffic (Kubernetes readinessProbe). Returns 503
 *                  while MongoDB is disconnected so the pod is taken out of the Service.
 */
function registerHealthRoutes(app, mongoose, info) {
    app.get('/livez', (req, res) => res.status(200).json({ status: 'ALIVE' }));

    app.get('/health', (req, res) => {
        const dbUp = mongoose ? isDbReady(mongoose) : true;
        return res.status(dbUp ? 200 : 503).json({
            ...info,
            status: dbUp ? 'UP' : 'DATABASE_DISCONNECTED',
            database: mongoose ? (dbUp ? 'CONNECTED' : 'DISCONNECTED') : 'N/A',
            pod: process.env.POD_NAME || undefined,
            timestamp: new Date().toISOString()
        });
    });
}

function safeDecode(value) {
    try {
        return decodeURIComponent(String(value || '')).trim();
    } catch (e) {
        return String(value || '').trim();
    }
}

/**
 * Identity verified by the API Gateway (from the JWT) and forwarded as headers.
 * The gateway strips any client-supplied x-user-* headers before setting these.
 */
function getIdentity(req) {
    return {
        id: String(req.headers['x-user-id'] || '').trim(),
        email: String(req.headers['x-user-email'] || '').trim().toLowerCase(),
        role: String(req.headers['x-user-role'] || '').trim().toLowerCase(),
        // name/department are URI-encoded by the gateway (headers must be ASCII)
        name: safeDecode(req.headers['x-user-name']),
        department: safeDecode(req.headers['x-user-department'])
    };
}

/**
 * Express middleware: requires an authenticated identity with one of the given roles.
 * Defence in depth: the gateway already checks roles, this protects the service if
 * it is ever reached directly inside the cluster.
 */
function requireRole(...roles) {
    const allowed = roles.flat().map(r => r.toLowerCase());
    return (req, res, next) => {
        const identity = getIdentity(req);
        if (!identity.email || !identity.role) {
            return res.status(401).json({ success: false, message: 'Missing authenticated identity from API Gateway.' });
        }
        if (allowed.length && !allowed.includes(identity.role)) {
            return res.status(403).json({ success: false, message: `Role '${identity.role}' is not allowed. Required: [${allowed.join(', ')}]` });
        }
        req.identity = identity;
        next();
    };
}

function generateId(prefix) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${Date.now().toString().slice(-6)}${rand}`;
}

/** Escape user input before putting it inside a RegExp (prevents regex injection / ReDoS). */
function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive exact match, safe for user input. */
function exactInsensitive(value) {
    return new RegExp(`^${escapeRegex(value)}$`, 'i');
}

/** Case-insensitive "contains" match, safe for user input. */
function containsInsensitive(value) {
    return new RegExp(escapeRegex(value), 'i');
}

/** Clamp a numeric query parameter (e.g. ?limit=) to a sane range. */
function clampInt(value, fallback, min, max) {
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(Math.max(n, min), max);
}

function startServer(app, port, serviceName) {
    return app.listen(port, '0.0.0.0', () => {
        console.log(`[${serviceName}] Running on PORT: ${port}${process.env.POD_NAME ? ` (pod ${process.env.POD_NAME})` : ''}`);
    });
}

module.exports = {
    registerHealthRoutes,
    getIdentity,
    requireRole,
    generateId,
    escapeRegex,
    exactInsensitive,
    containsInsensitive,
    clampInt,
    startServer
};
