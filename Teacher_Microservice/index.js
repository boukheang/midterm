/**
 * Teacher Microservice
 * Endpoints (all require role 'faculty', verified by the API Gateway):
 *   GET  /api/teachers/user_info
 *   PUT  /api/teachers/update_info
 *   GET  /api/teachers/room_schedule
 * The route logic lives in ../shared/portal.js and is shared with the
 * other portal service so the two cannot drift apart.
 */
const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
require('dotenv').config();

const { connectDB } = require('../shared/db');
const { registerHealthRoutes, startServer } = require('../shared/service');
const { registerPortal } = require('../shared/portal');

const app = express();
app.use(express.json({ limit: '100kb' }));

const PORT = process.env.PORT || 5008;

connectDB(mongoose, 'Teacher Service');
registerHealthRoutes(app, mongoose, { service: 'Teacher Microservice', port: PORT });

registerPortal({ app, express, bcrypt, mongoose }, {
    basePath: '/api/teachers',
    role: 'faculty',
    label: 'Faculty member',
    rosterField: 'assignedFaculty',
    logTag: 'Teacher Service'
});

startServer(app, PORT, 'Teacher Service');

module.exports = app;
