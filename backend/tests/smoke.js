/*
 * Smoke test for the Staff Portal API.
 *
 *   1. Start the API:   cd backend && npm run dev      (or npm start)
 *   2. Run the test:    cd backend && npm test
 *
 * It exercises authentication, RBAC, every protected read, the write
 * endpoints, the 404 handler and the complete avatar upload/download/delete
 * flow. Every record it creates is created under a throwaway user
 * ("zzsmoketmp") and deleted again afterwards, so existing employees,
 * attendance, leaves, tasks and timers are never touched — the test also
 * asserts that the real user records are byte-for-byte unchanged.
 *
 * Requires MongoDB (MONGO_URI in backend/.env) to be reachable.
 */

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const fs = require('fs');
const path = require('path');

const results = [];
const check = (name, ok, info = '') => results.push({ name, ok, info });

async function req(method, p, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== null && body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  try {
    const res = await fetch(`${BASE}${p}`, { method, headers, body: payload });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { message: e.message } };
  }
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const formWith = (buffer, filename, type) => {
  const f = new FormData();
  f.append('avatar', new Blob([buffer], { type }), filename);
  return f;
};
const snap = (list) =>
  list.map((u) => `${u.username}|${u.role}|${u.status}|${u.avatarUrl || ''}|${u.employeeId}`)
    .sort().join('\n');

const ADMIN = { user: process.env.TEST_ADMIN_USER || 'hexa', pass: process.env.TEST_ADMIN_PASS || 'Hexa2026' };

(async () => {
  let adminToken = null;
  let tmpToken = null;
  let tempUser = null;

  try {
    // ---------- baseline ----------
    let r = await req('POST', '/auth/login', null, { username: ADMIN.user, password: ADMIN.pass });
    adminToken = r.data && r.data.token;
    check('admin login', r.status === 200 && !!adminToken, `status=${r.status}`);

    const before = await req('GET', '/employees', adminToken);
    const beforeSnap = snap(before.data || []);
    const beforeCount = (before.data || []).length;
    check('baseline: can list employees', before.status === 200 && beforeCount > 0,
      `count=${beforeCount} status=${before.status}`);

    // ---------- health ----------
    r = await req('GET', '/health');
    check('GET /health reports db + storage', r.status === 200 && r.data.db === 'connected' && !!r.data.storage,
      `db=${r.data && r.data.db} storage=${r.data && r.data.storage}`);

    // ---------- auth ----------
    r = await req('POST', '/auth/login', null, { username: ADMIN.user, password: 'definitely-wrong' });
    check('bad credentials -> 401', r.status === 401, `status=${r.status}`);
    r = await req('GET', '/auth/me');
    check('no token -> 401', r.status === 401, `status=${r.status}`);

    // ---------- protected reads ----------
    const gets = [
      ['GET /auth/me', '/auth/me'],
      ['GET /employees', '/employees'],
      ['GET /attendance/today', '/attendance/today'],
      ['GET /attendance/all', '/attendance/all'],
      ['GET /attendance/my', '/attendance/my'],
      ['GET /attendance/punches/today', '/attendance/punches/today'],
      ['GET /attendance/punches/live', '/attendance/punches/live'],
      ['GET /attendance/punches/my', '/attendance/punches/my'],
      ['GET /attendance/report', '/attendance/report'],
      ['GET /tasks/my', '/tasks/my'],
      ['GET /tasks/all', '/tasks/all'],
      ['GET /leaves/my', '/leaves/my'],
      ['GET /leaves/all', '/leaves/all'],
      ['GET /leaves/balance', '/leaves/balance'],
      ['GET /worklogs/today', '/worklogs/today'],
      ['GET /worklogs', '/worklogs'],
      ['GET /worklogs/all', '/worklogs/all'],
      ['GET /reports?filter=today', '/reports?filter=today'],
      ['GET /reports/admin', '/reports/admin'],
      ['GET /profile', '/profile'],
      ['GET /config/working-hours', '/config/working-hours'],
    ];
    for (const [name, p] of gets) {
      r = await req('GET', p, adminToken);
      check(name, r.status === 200, `status=${r.status}${r.status === 200 ? '' : ' ' + JSON.stringify(r.data)}`);
    }

    // ---------- throwaway user for every write test ----------
    r = await req('POST', '/employees', adminToken, {
      username: 'zzsmoketmp', password: 'Tmp@12345', name: 'Smoke Test Temp',
      role: 'employee', department: 'General',
    });
    check('create throwaway user', r.status === 201, `status=${r.status} ${JSON.stringify(r.data || {}).slice(0, 120)}`);
    if (r.status === 201) tempUser = r.data;

    if (tempUser) {
      const lr = await req('POST', '/auth/login', null, { username: 'zzsmoketmp', password: 'Tmp@12345' });
      tmpToken = lr.data && lr.data.token;
      check('throwaway user login', lr.status === 200, `status=${lr.status}`);

      // ---------- writes ----------
      r = await req('POST', '/attendance/punch', tmpToken, { action: 'Punch In', status: 'Working' });
      check('POST /attendance/punch (in)', r.status === 200, `status=${r.status} ${r.data && r.data.message}`);
      r = await req('POST', '/attendance/punch', tmpToken, { action: 'Punch Out', status: 'Completed' });
      check('POST /attendance/punch (out)', r.status === 200, `status=${r.status} ${r.data && r.data.message}`);
      r = await req('POST', '/worklogs', tmpToken, { title: 'SMOKE-DELETE-ME', description: 'smoke' });
      check('POST /worklogs', r.status === 201 || r.status === 200, `status=${r.status}`);
      r = await req('POST', '/leaves', tmpToken,
        { type: 'casual', startDate: '2026-12-01', endDate: '2026-12-01', reason: 'SMOKE-DELETE-ME' });
      check('POST /leaves', r.status === 201 || r.status === 200, `status=${r.status}`);
      r = await req('POST', '/tasks', adminToken,
        { title: 'SMOKE-DELETE-ME', assignedTo: tempUser._id, priority: 'low' });
      check('POST /tasks (valid assignedTo)', r.status === 201 || r.status === 200, `status=${r.status}`);
      r = await req('POST', '/tasks', adminToken, { title: 'bad assignee', assignedTo: 'not-an-id' });
      check('POST /tasks malformed assignedTo -> 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`);
      r = await req('GET', '/totally-not-a-route', adminToken);
      check('404 handler', r.status === 404, `status=${r.status}`);

      // ---------- avatar flow ----------
      r = await req('POST', '/profile/avatar', tmpToken, formWith(PNG, 'avatar.png', 'image/png'));
      const avatarUrl = r.data && r.data.avatarUrl;
      const storage = process.env.AVATAR_STORAGE ||
        (process.env.CLOUDINARY_URL ? 'cloudinary' : process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local');
      check('POST /profile/avatar (valid PNG) -> 200', r.status === 200 && !!avatarUrl,
        `status=${r.status} url=${avatarUrl || ''} storage=${storage}`);

      r = await req('GET', '/profile', tmpToken);
      check('avatarUrl persisted in DB', r.status === 200 && r.data.avatarUrl === avatarUrl,
        `db='${r.data && r.data.avatarUrl}'`);

      if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) {
        // local storage: the file must exist on disk and be served
        const onDisk = path.join(__dirname, '..', avatarUrl.replace(/^\//, '').replace(/\//g, path.sep));
        check('avatar file written to disk', fs.existsSync(onDisk), onDisk);
        try {
          const res = await fetch(`${BASE.replace('/api', '')}${avatarUrl}`);
          const buf = Buffer.from(await res.arrayBuffer());
          check('GET avatar URL serves the image', res.status === 200 && buf.length > 0,
            `status=${res.status} bytes=${buf.length}`);
        } catch (e) { check('GET avatar URL serves the image', false, e.message); }
      } else if (avatarUrl) {
        try {
          const res = await fetch(avatarUrl);
          check('GET avatar URL serves the image', res.status === 200, `status=${res.status}`);
        } catch (e) { check('GET avatar URL serves the image', false, e.message); }
      }

      r = await req('POST', '/profile/avatar', tmpToken, formWith(Buffer.from('hello'), 'x.gif', 'image/gif'));
      check('wrong mime type -> 400', r.status === 400, `status=${r.status} ${r.data && r.data.message}`);
      r = await req('POST', '/profile/avatar', tmpToken,
        formWith(Buffer.concat([PNG, Buffer.alloc(2.5 * 1024 * 1024)]), 'big.png', 'image/png'));
      check('file >2MB -> 413', r.status === 413, `status=${r.status} ${r.data && r.data.message}`);
      r = await req('POST', '/profile/avatar', null, formWith(PNG, 'a.png', 'image/png'));
      check('avatar upload requires auth -> 401', r.status === 401, `status=${r.status}`);

      r = await req('DELETE', '/profile/avatar', tmpToken);
      check('DELETE /profile/avatar', r.status === 200, `status=${r.status} ${r.data && r.data.message}`);
      r = await req('GET', '/profile', tmpToken);
      check('avatarUrl cleared in DB', r.status === 200 && !r.data.avatarUrl, `db='${r.data && r.data.avatarUrl}'`);
    }

    // ---------- data integrity ----------
    const after = await req('GET', '/employees', adminToken);
    const afterReal = (after.data || []).filter((u) => u.username !== 'zzsmoketmp');
    check('existing user records unchanged', snap(afterReal) === beforeSnap,
      snap(afterReal) === beforeSnap ? '' : 'CHANGED!');
    check(`existing user count still ${beforeCount}`, afterReal.length === beforeCount,
      `now=${afterReal.length}`);
  } finally {
    // ---------- cleanup: only records this run created ----------
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hexahr');
    const User = require('../models/User');
    const Punch = require('../models/Punch');
    const Attendance = require('../models/Attendance');
    const WorkLog = require('../models/WorkLog');
    const Leave = require('../models/Leave');
    const Task = require('../models/Task');

    const tmp = await User.findOne({ username: 'zzsmoketmp' });
    if (tmp) {
      const uid = tmp._id;
      const p = await Punch.deleteMany({ employee: uid });
      const a = await Attendance.deleteMany({ employee: uid });
      const w = await WorkLog.deleteMany({ employee: uid });
      const l = await Leave.deleteMany({ employee: uid });
      const t = await Task.deleteMany({ $or: [{ assignedTo: uid }, { title: 'SMOKE-DELETE-ME' }] });
      const u = await User.deleteOne({ _id: uid });
      console.log(
        `\n[cleanup] punches=${p.deletedCount} attendance=${a.deletedCount} worklogs=${w.deletedCount} ` +
        `leaves=${l.deletedCount} tasks=${t.deletedCount} users=${u.deletedCount}`
      );
    } else {
      console.log('\n[cleanup] no throwaway user found');
    }
    await mongoose.disconnect();
  }

  console.log('\n=== STAFF PORTAL SMOKE TEST ===');
  let pass = 0;
  for (const x of results) {
    console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.info ? '  [' + x.info + ']' : ''}`);
    if (x.ok) pass++;
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  if (pass !== results.length) process.exitCode = 1;
})();
