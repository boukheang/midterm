/**
 * Student Microservice
 * Endpoints (all require role 'student', verified by the API Gateway):
 *   GET  /api/students/user_info
 *   PUT  /api/students/update_info
 *   GET  /api/students/room_schedule
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

const PORT = process.env.PORT || 5007;

connectDB(mongoose, 'Student Service');
registerHealthRoutes(app, mongoose, { service: 'Student Microservice', port: PORT });

registerPortal({ app, express, bcrypt, mongoose }, {
    basePath: '/api/students',
    role: 'student',
    label: 'Student',
    rosterField: 'enrolledStudents',
    logTag: 'Student Service'
});

startServer(app, PORT, 'Student Service');

module.exports = app;
