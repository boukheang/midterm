/**
 * Single source of truth for "is this permission valid right now?".
 * Used by the Permission service (/check) and the Access Log service (door swipe),
 * which previously each had their own copy of this logic.
 */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hhmm(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * @param {object} permission access_permissions document
 * @param {Date} now
 * @returns {{ allowed: boolean, reason: string, message: string }}
 */
function evaluatePermissionWindow(permission, now = new Date()) {
    if (!permission) {
        return { allowed: false, reason: 'NO_PERMISSION', message: 'No active permission exists for this user and room.' };
    }
    if (permission.validFrom && now < new Date(permission.validFrom)) {
        return { allowed: false, reason: 'NOT_YET_VALID', message: 'This permission is not yet valid.' };
    }
    if (permission.validUntil && now > new Date(permission.validUntil)) {
        return { allowed: false, reason: 'PERMISSION_EXPIRED', message: 'This permission has expired.' };
    }

    const currentDay = DAYS[now.getDay()];
    if (Array.isArray(permission.allowedDays) && permission.allowedDays.length > 0 &&
        !permission.allowedDays.some(day => String(day).toLowerCase() === currentDay.toLowerCase())) {
        return { allowed: false, reason: `OUTSIDE_ALLOWED_DAYS_${currentDay.toUpperCase()}`, message: `Access is not permitted on ${currentDay}.` };
    }

    const currentTime = hhmm(now);
    if (permission.startTime && permission.endTime &&
        (currentTime < permission.startTime || currentTime > permission.endTime)) {
        return {
            allowed: false,
            reason: `OUTSIDE_SCHEDULED_HOURS_${currentTime}`,
            message: `Access is allowed from ${permission.startTime} to ${permission.endTime}.`
        };
    }

    return { allowed: true, reason: 'AUTHORIZED', message: 'User is authorized for room access.' };
}

module.exports = { evaluatePermissionWindow, DAYS };
