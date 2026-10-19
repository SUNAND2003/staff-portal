// Vercel serverless entry point for the Staff Portal API.
//
// vercel.json rewrites every request to this file, and the Express app below
// receives the original request path, so it routes /api/auth, /api/employees,
// /api/attendance, … exactly as it does locally.
//
// The file is deliberately NOT called `index.js`: naming it `app.js` keeps the
// rewrite destination (`/api/app`) unambiguous.
const app = require('../backend/server');

module.exports = app;
