// src/utils/auth.js

const AUTH_KEY = "hexa-auth-session";
const STAFF_KEY = "hexa-staff-db";

// ─────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────

export const ROLES = {
  ADMIN: "admin",
  EMPLOYEE: "employee",
};

// ─────────────────────────────────────────────
// SEED STAFF (Only 2 accounts remain)
// ─────────────────────────────────────────────

const SEED_STAFF = [
  {
    username: "admin",
    password: "admin123",
    name: "Admin User",
    role: "admin",
    employeeId: "HEXA-0001",
    department: "Management",
    status: "active",
    createdAt: "2024-01-01",
    avatar: 12,
  },

  {
    username: "sunand",
    password: "emp123",
    name: "Sunand T",
    role: "employee",
    employeeId: "HEXA-1024",
    department: "Engineering",
    status: "active",
    createdAt: "2024-03-15",
    avatar: 22,
  },

];

// ─────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────

function loadDynamic() {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDynamic(list) {
  localStorage.setItem(STAFF_KEY, JSON.stringify(list));
}

// ─────────────────────────────────────────────
// STAFF READ
// ─────────────────────────────────────────────

export function getAllStaff() {

  const dynamic = loadDynamic();

  const seedUsernames = new Set(
    SEED_STAFF.map((s) => s.username)
  );

  const filtered = dynamic.filter(
    (d) => !seedUsernames.has(d.username)
  );

  return [...SEED_STAFF, ...filtered];
}

// ─────────────────────────────────────────────
// GENERATE EMPLOYEE ID
// ─────────────────────────────────────────────

export function generateEmployeeId() {

  const all = getAllStaff();

  const nums = all
    .map((s) =>
      parseInt(
        s.employeeId?.replace("HEXA-", "") || "0",
        10
      )
    )
    .filter((n) => !isNaN(n));

  // Starts generating at HEXA-1025 since sunand is HEXA-1024
  const next = Math.max(...nums, 1024) + 1;

  return `HEXA-${next}`;
}

// ─────────────────────────────────────────────
// CREATE EMPLOYEE
// ─────────────────────────────────────────────

export function createEmployee({
  name,
  username,
  password,
  department,
  role,
}) {

  const all = getAllStaff();

  if (
    all.some((s) => s.username === username)
  ) {
    return {
      success: false,
      error: "Username already exists.",
    };
  }

  const employee = {
    username,
    password,

    name,

    role: role || ROLES.EMPLOYEE,

    employeeId: generateEmployeeId(),

    department,

    status: "active",

    avatar: Math.floor(Math.random() * 70),

    createdAt: new Date()
      .toISOString()
      .split("T")[0],
  };

  const dynamic = loadDynamic();

  dynamic.push(employee);

  saveDynamic(dynamic);

  return {
    success: true,
    employee,
  };
}

// ─────────────────────────────────────────────
// TOGGLE STATUS
// ─────────────────────────────────────────────

export function toggleEmployeeStatus(employeeId) {

  const dynamic = loadDynamic();

  const idx = dynamic.findIndex(
    (s) => s.employeeId === employeeId
  );

  if (idx !== -1) {

    dynamic[idx].status =
      dynamic[idx].status === "active"
        ? "inactive"
        : "active";

    saveDynamic(dynamic);

    return;
  }

  const seed = SEED_STAFF.find(
    (s) => s.employeeId === employeeId
  );

  if (seed) {

    dynamic.push({
      ...seed,
      status: "inactive",
    });

    saveDynamic(dynamic);
  }
}

// ─────────────────────────────────────────────
// DELETE EMPLOYEE
// ─────────────────────────────────────────────

export function deleteEmployee(employeeId) {

  const dynamic = loadDynamic();

  saveDynamic(
    dynamic.filter(
      (s) => s.employeeId !== employeeId
    )
  );
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

export function login(
  username,
  password,
  role
) {

  const all = getAllStaff();

  const user = all.find(
    (u) =>
      u.username === username &&
      u.password === password &&
      u.role === role
  );

  if (!user) {
    return {
      success: false,
      error: "Invalid credentials",
    };
  }

  if (user.status === "inactive") {
    return {
      success: false,
      error:
        "Account is deactivated. Contact admin.",
    };
  }

  // Clear old session
  localStorage.removeItem(AUTH_KEY);

  // Create fresh session
  const session = {
    role: user.role,

    username: user.username,

    name: user.name,

    employeeId: user.employeeId,

    department: user.department,

    avatar: user.avatar || 20,
  };

  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify(session)
  );

  return {
    success: true,
    session,
  };
}

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────

export function logout() {

  localStorage.removeItem(AUTH_KEY);
}

// ─────────────────────────────────────────────
// GET SESSION
// ─────────────────────────────────────────────

export function getSession() {

  try {

    const raw = localStorage.getItem(
      AUTH_KEY
    );

    return raw ? JSON.parse(raw) : null;

  } catch {

    return null;
  }
}

// ─────────────────────────────────────────────
// IS AUTHENTICATED
// ─────────────────────────────────────────────

export function isAuthenticated() {

  return getSession() !== null;
}