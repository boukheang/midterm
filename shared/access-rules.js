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

    const currentTime = hhmm(now);
    const { startTime, endTime } = permission;
    // Overnight window (e.g. 22:00-02:00): start is later than end.
    const overnight = Boolean(startTime && endTime && startTime > endTime);

    // The weekday that "owns" this moment. In an overnight window the early-morning
    // part belongs to the previous day: Friday 22:00-02:00 covers Saturday 01:30.
    let shiftDay = now.getDay();
    if (overnight && currentTime <= endTime) {
        shiftDay = (shiftDay + 6) % 7;
    }
    const currentDay = DAYS[shiftDay];

    if (Array.isArray(permission.allowedDays) && permission.allowedDays.length > 0 &&
        !permission.allowedDays.some(day => String(day).toLowerCase() === currentDay.toLowerCase())) {
        return { allowed: false, reason: `OUTSIDE_ALLOWED_DAYS_${currentDay.toUpperCase()}`, message: `Access is not permitted on ${currentDay}.` };
    }

    if (startTime && endTime) {
        const inWindow = overnight
            ? currentTime >= startTime || currentTime <= endTime
            : currentTime >= startTime && currentTime <= endTime;
        if (!inWindow) {
            return {
                allowed: false,
                reason: `OUTSIDE_SCHEDULED_HOURS_${currentTime}`,
                message: `Access is allowed from ${startTime} to ${endTime}${overnight ? ' (overnight)' : ''}.`
            };
        }
    }

    return { allowed: true, reason: 'AUTHORIZED', message: 'User is authorized for room access.' };
}

module.exports = { evaluatePermissionWindow, DAYS };
