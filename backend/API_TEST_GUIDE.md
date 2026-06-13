# Punch & Attendance System - API Testing Guide

## Prerequisites
1. MongoDB running locally on `mongodb://localhost:27017`
2. Backend server running on `http://localhost:5000`
3. Frontend running on `http://localhost:5173`

## Authentication

### 1. Login (Public)
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "...",
    "username": "admin",
    "name": "Admin User",
    "role": "admin",
    "employeeId": "HEXA-1001",
    ...
  }
}
```

**Save the token for all subsequent requests:**
```
Authorization: Bearer <token>
```

---

## Employee Punch API

### 2. Record Punch
```bash
POST /api/attendance/punch
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "Punch In",
  "status": "Working"
}
```

**Valid Actions:** `"Punch In"`, `"Punch Out"`, `"Break Start"`, `"Break End"`

**Response:**
```json
{
  "success": true,
  "punch": {
    "_id": "...",
    "employee": "user-id",
    "employeeId": "HEXA-1001",
    "employeeName": "John Doe",
    "action": "Punch In",
    "status": "Working",
    "timestamp": "2025-05-23T09:30:00.000Z",
    "date": "2025-05-23"
  },
  "message": "Punch In recorded successfully"
}
```

### 3. Get Today's Punches (Employee)
```bash
GET /api/attendance/punches/today
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "punches": [
    {
      "_id": "...",
      "employeeId": "HEXA-1001",
      "employeeName": "John Doe",
      "action": "Punch In",
      "status": "Working",
      "timestamp": "2025-05-23T09:30:00.000Z",
      "date": "2025-05-23"
    },
    ...
  ],
  "count": 2
}
```

### 4. Get Live Punches (Admin/Manager)
```bash
GET /api/attendance/punches/live?limit=50&skip=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "punches": [
    {
      "_id": "...",
      "employeeId": "HEXA-1001",
      "employeeName": "John Doe",
      "action": "Punch In",
      "status": "Working",
      "timestamp": "2025-05-23T09:30:00.000Z"
    },
    ...
  ],
  "total": 15,
  "limit": 50,
  "skip": 0,
  "timestamp": "2025-05-23T12:00:00.000Z"
}
```

### 5. Get Employee Punches (Admin/Manager)
```bash
GET /api/attendance/punches/employee/HEXA-1001?date=2025-05-23&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "punches": [...],
  "count": 4,
  "employeeId": "HEXA-1001",
  "date": "2025-05-23"
}
```

---

## Attendance API

### 6. Check In
```bash
POST /api/attendance/checkin
Authorization: Bearer <token>
```

**Response:**
```json
{
  "checkInTime": "2025-05-23T09:30:00.000Z",
  "status": "working",
  "isLate": false,
  "record": { ... }
}
```

### 7. Check Out
```bash
POST /api/attendance/checkout
Authorization: Bearer <token>
```

### 8. Break Start
```bash
POST /api/attendance/break/start
Authorization: Bearer <token>
```

### 9. Break End
```bash
POST /api/attendance/break/end
Authorization: Bearer <token>
```

### 10. Get Today's Attendance
```bash
GET /api/attendance/today
Authorization: Bearer <token>
```

**Response:**
```json
{
  "_id": "...",
  "employee": "user-id",
  "employeeId": "HEXA-1001",
  "date": "2025-05-23",
  "checkIn": "2025-05-23T09:30:00.000Z",
  "checkOut": "2025-05-23T18:00:00.000Z",
  "status": "checked_out",
  "breaks": [...],
  "workSeconds": 28800,
  "breakSeconds": 1800,
  "totalHours": 7.5,
  "isLate": false
}
```

### 11. Get All Attendance (Admin)
```bash
GET /api/attendance/all?date=2025-05-23&department=Engineering
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "...",
    "employee": { ... },
    "employeeId": "HEXA-1001",
    "date": "2025-05-23",
    "checkIn": "...",
    "checkOut": "...",
    "status": "checked_out",
    "totalHours": 7.5,
    "isLate": false
  },
  ...
]
```

---

## Testing Workflow

### Scenario 1: Employee Punch In/Out (Cross-Browser Test)

1. **Browser 1 - Employee punches in:**
   ```
   POST /api/attendance/punch
   { "action": "Punch In", "status": "Working" }
   ```

2. **Verify punch was saved** (should appear in punches collection):
   ```
   GET /api/attendance/punches/today
   ```

3. **Browser 2 - Admin dashboard (should see live punch):**
   ```
   GET /api/attendance/punches/live
   ```
   Should show the punch from step 1 within 5 seconds.

4. **Browser 1 - Employee takes break:**
   ```
   POST /api/attendance/punch
   { "action": "Break Start", "status": "On Break" }
   ```

5. **Browser 2 - Admin should see break start:**
   ```
   GET /api/attendance/punches/live
   ```
   Should see new punch event.

6. **Browser 1 - Employee resumes work:**
   ```
   POST /api/attendance/punch
   { "action": "Break End", "status": "Working" }
   ```

7. **Browser 1 - Employee punches out:**
   ```
   POST /api/attendance/punch
   { "action": "Punch Out", "status": "Completed" }
   ```

8. **Browser 2 - Verify attendance record created:**
   ```
   GET /api/attendance/all
   ```
   Should show completed attendance with:
   - checkIn time
   - checkOut time
   - totalHours calculated
   - breaks recorded

### Scenario 2: Multi-Employee Attendance Report

1. Have 3+ employees punch in/out
2. Admin calls:
   ```
   GET /api/attendance/all?date=2025-05-23
   ```
3. Should see all employees' records with correct calculations

---

## Data Persistence Tests

### Test 1: Data Survives Page Refresh
1. Employee punches in
2. Employee refreshes page
3. GET /api/attendance/today should still show punch

### Test 2: Cross-Browser Sync
1. Employee (Browser A) punches in at 9:30 AM
2. Admin (Browser B) sees punch within 5 seconds in live feed
3. Admin (Browser C) opens admin dashboard, also sees punch

### Test 3: MongoDB Persistence
1. Stop backend server
2. Restart backend server
3. Old punch records should still exist

---

## Expected Success Criteria

✅ Punch records save to MongoDB  
✅ Admin sees live feed update within 5 seconds  
✅ Cross-browser punch sync works  
✅ Attendance records auto-created on punch in  
✅ Work hours calculated correctly on punch out  
✅ Break times tracked  
✅ Employee can't punch in twice  
✅ Clear error messages on validation failure  

---

## Error Handling Tests

### Test: Already Punched In
```
Employee attempts: POST /api/attendance/punch { "action": "Punch In", "status": "Working" }
When already punched in

Expected: 400 error - "Already checked in today"
```

### Test: Punch Out Without Punch In
```
POST /api/attendance/punch { "action": "Punch Out", "status": "Completed" }
Without punching in first

Expected: 400 error - "Not checked in today"
```

### Test: Unauthorized Access
```
GET /api/attendance/punches/live
(no token)

Expected: 401 error - "Not authorized"
```

---

## Manual Testing Checklist

- [ ] Create test user accounts (admin, employee1, employee2)
- [ ] Admin logs in, employee1 logs in (different browser)
- [ ] Employee1 punches in
- [ ] Admin sees punch in live feed
- [ ] Employee1 takes break
- [ ] Admin sees break start in feed
- [ ] Employee1 resumes work
- [ ] Admin sees break end in feed
- [ ] Employee1 punches out
- [ ] Admin sees final check out
- [ ] Admin attendance table shows complete record with hours
- [ ] Refresh page - data persists
- [ ] Open in new browser - data still visible
- [ ] Next day - employee can punch in again
- [ ] Attendance report shows correct hours and status

---

## Notes

- All timestamps are in UTC ISO format
- Dates are in "YYYY-MM-DD" format (local timezone)
- Employee ID format: "HEXA-XXXX" (auto-generated)
- Attendance records are unique per employee per day
- Work hours exclude break time
- Late threshold: 9:15 AM
