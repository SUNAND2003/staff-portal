# Staff Portal — Vercel deployment

Two Vercel projects are created from **this single repository**:

| Project | URL | Root Directory | What it serves |
|---|---|---|---|
| Frontend | https://hexaportal.vercel.app | `frontend` | Vite React app (static) |
| Backend | https://staffportal-kbwe.vercel.app | *(leave empty — repository root)* | Express API via `api/app.js` |

The backend project routes **every** request to `api/app.js` (see `vercel.json`),
which `require`s `backend/server.js` and hands Vercel the Express app as the
function handler.

---

## 1. Package manager and build settings (the `yarn` failure)

The build log showed:

```
Build command: yarn
No lockfile found. Could not determine the package manager...
```

There is **no `yarn.lock`** anywhere in the repository — the lockfile is npm's
`package-lock.json` (root, `backend/`, `frontend/`). So the project must be
installed with npm.

**Vercel dashboard → Backend project → Settings → General → Build & Output
Settings:**

| Setting | Value | Why |
|---|---|---|
| Framework Preset | `Other` | No framework at the root; `api/` supplies the function. |
| **Install Command** | `npm ci` | Reproducible install from `package-lock.json`. `yarn` fails because no `yarn.lock` exists. |
| **Build Command** | *(leave empty)* | The Express app needs no build step. |
| **Output Directory** | *(leave empty)* | Static output does not apply to the API. |
| Root Directory | *(leave empty)* | Must stay at the repository root so `api/app.js`, `vercel.json` and the root `package.json` are visible. |

**Frontend project → same page:**

| Setting | Value |
|---|---|
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

> `installCommand` / `buildCommand` are **not** valid keys in `vercel.json`
> (verified against the Vercel CLI config schema, which only accepts
> `builds`, `routes`, `rewrites`, `redirects`, `headers`, `functions`,
> `cleanUrls`, `trailingSlash`, `images`, `regions`-era routing keys, etc.).
> Putting them there fails schema validation, so they belong in the dashboard.

What was done in the repository to make `npm ci` work:

* root `package.json` — npm workspace (`workspaces: ["backend"]`), so an install
  at the repository root also installs the API's dependencies;
* root `package-lock.json` and a regenerated `backend/package-lock.json`, both in
  sync with their manifests;
* `backend/node_modules` is **no longer committed** (it was tracked; the
  frontend's never was). `.vercelignore` + `.gitignore` exclude `node_modules`,
  so dependencies always come from the lockfile instead of stale copies.
  Clones need `npm install` once before local work.

Verified from a clean copy (source + manifests only, no `node_modules`):
`npm ci` → exit 0, **no** "Multer 1.x" deprecation warning, no lockfile/manifest
mismatch, then the full API test suite passed against that install.

---

## 2. Environment variables (Backend project → Settings → Environment Variables)

`.vercelignore` keeps `backend/.env` out of the deployment, so these must be set
in the dashboard. Set them for **Production, Preview and Development**. Never
hard-code credentials in the source.

| Name | Required | Value | Notes |
|---|---|---|---|
| `MONGO_URI` | ✅ | `mongodb+srv://<user>:<pass>@<cluster>/<db>` | **A hosted database (MongoDB Atlas).** `mongodb://localhost:27017/...` cannot be reached from Vercel and was one cause of the 500s. |
| `JWT_SECRET` | ✅ | same value as in `backend/.env` | Currently `hexahr_super_secret_key_2025_sunand`. Rotate it before going public, then update both places. |
| `FRONTEND_URL` | ✅ | `https://hexaportal.vercel.app,http://localhost:5173` | Comma-separated CORS allow-list. Local dev stops working if you omit the `localhost` entry. |
| `CLOUDINARY_URL` | ✅ one of the three storage options | `cloudinary://<api_key>:<api_secret>@<cloud_name>` | **Preferred avatar storage.** This is Cloudinary's *API environment variable* (see §4). |
| `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | alternative to `CLOUDINARY_URL` | the three values separately | Same credentials split into three variables — use these if your setup injects one variable per key. |
| `BLOB_READ_WRITE_TOKEN` | alternative to Cloudinary | injected by Vercel when a Blob store is connected | Only used when no Cloudinary credentials are present (see §4). |
| `JWT_EXPIRES_IN` | optional | `7d` | Default behaviour if unset. |
| `NODE_ENV` | optional | `production` | Prevents stack traces from being returned in error responses. |
| `PORT` | optional | *(omit)* | Ignored on Vercel. |
| `AVATAR_STORAGE` | optional | `cloudinary` \| `blob` \| `local` \| `unconfigured` | Force a storage backend instead of auto-detecting. |

### Frontend project

`VITE_API_URL` is baked into the bundle **at build time** — it is read from
`frontend/.env.production`:

```
VITE_API_URL=https://staffportal-kbwe.vercel.app/api
```

(`frontend/.env.development` keeps `http://localhost:5000/api` for local work.)
If you rename the backend project, update `.env.production` and redeploy the
frontend — otherwise the browser keeps calling a dead URL.

---

## 3. Deploy steps

1. Commit and push everything, including the previously untracked files:
   `package.json`, `package-lock.json`, `api/`, `vercel.json`, `.vercelignore`,
   `.gitignore`, `backend/services/`, `backend/tests/`, `DEPLOYMENT.md`, the
   modified `backend/*.js` files, `backend/package.json`,
   `backend/package-lock.json` — and the staged removal of the ~3 552 tracked
   `backend/node_modules` files (they stay on disk; they are simply no longer
   versioned, exactly like `frontend/node_modules`, which never was).
2. **Backend project**
   - Settings → General → *Root Directory*: leave **empty** (repository root).
   - Settings → General → *Build & Output Settings*: Install Command `npm ci`,
     Build Command empty, Output Directory empty (§1).
   - Settings → Environment Variables: add the required variables from §2
     (`MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, and one storage option).
   - Deployments → *Redeploy* (a redeploy is required; env vars, build settings
     and `.vercelignore` only apply to new builds).
3. **Frontend project** → Build & Output Settings (`npm ci`, `npm run build`,
   `dist`) → Deployments → *Redeploy* so the bundle is rebuilt with the API URL
   from `.env.production`.
4. Confirm CORS: `FRONTEND_URL` must contain the exact frontend origin
   (`https://hexaportal.vercel.app`), otherwise the browser reports a CORS error.

---

## 4. Avatar storage (Cloudinary preferred)

Files cannot be written to the serverless filesystem — that was the original
crash:

```
ENOENT: no such file or directory, mkdir '/var/task/backend/uploads/avatars'
```

`backend/middleware/upload.js` now keeps the upload **in memory**
(`multer.memoryStorage()`, no disk access at module load), and
`backend/services/avatarStorage.js` decides where the bytes go **at request
time**:

| Priority | Condition | Backend |
|---|---|---|
| 1 | `AVATAR_STORAGE` set | that backend (error if its credentials are missing) |
| 2 | `CLOUDINARY_URL` or `CLOUDINARY_CLOUD_NAME`+`CLOUDINARY_API_KEY`+`CLOUDINARY_API_SECRET` set | **Cloudinary** (`https://api.cloudinary.com/v1_1/<cloud>/image/upload`) |
| 3 | `BLOB_READ_WRITE_TOKEN` set | Vercel Blob |
| 4 | running on Vercel, nothing configured | HTTP **503** naming both options — server keeps running |
| 5 | otherwise (development / self-hosted) | `backend/uploads/avatars` on disk, served by `/uploads/…` |

### Cloudinary setup

1. https://console.cloudinary.com → **Settings → API Keys** (free tier is fine;
   the *Go to API Keys* button on the Dashboard leads to the same page). Copy the
   **API environment variable** format shown there — it already contains your
   cloud name, and you fill in your key and secret.
2. Dashboard → Backend project → Settings → Environment Variables:
   * either one variable `CLOUDINARY_URL` =
     `cloudinary://<api_key>:<api_secret>@<cloud_name>` (exactly the API
     environment variable from that page), or
   * three variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
     `CLOUDINARY_API_SECRET`.
3. Redeploy the backend, then run §5 step 1: `"storage":"cloudinary"` confirms
   the credentials were picked up.

Uploads are signed server-side (SHA-1 over the sorted parameter list, the
official algorithm — verified byte-for-byte against Cloudinary's own SDK), so
**the API secret only ever exists in the dashboard environment, never in the
repository or the browser**. Avatars land under the public_id
`avatars/avatar-<userId>-<timestamp>`; deleting an avatar issues a signed
`destroy` call and clears `User.avatarUrl`.

Expected behaviour:

* **Development** (no credentials, not on Vercel) → unchanged: files go to
  `backend/uploads/avatars` and are served by `/uploads/…`.
* **Vercel + Cloudinary** → `POST /api/profile/avatar` returns an absolute
  `https://res.cloudinary.com/…` URL stored in `User.avatarUrl`.
* **Vercel + Blob only** → absolute `https://…public.blob.vercel-storage.com/…`.
* **Vercel, no storage configured** → HTTP **503** whose message names
  `CLOUDINARY_URL` / `CLOUDINARY_CLOUD_NAME`… or `BLOB_READ_WRITE_TOKEN`.
  No crash, no silent failure (asserted by `npm run test:storage`).

---

## 5. Verifying the deployment

```bash
# 1. Health — must return db:"connected" and a storage backend
curl https://staffportal-kbwe.vercel.app/api/health
#    ...,"db":"connected","storage":"cloudinary",...
#    storage: "cloudinary" = Cloudinary creds found
#            "vercel-blob" = Blob token found
#            "unconfigured"= nothing set -> avatar upload returns 503

# 2. Login
curl -X POST https://staffportal-kbwe.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 3. Protected route (paste the token from step 2)
curl https://staffportal-kbwe.vercel.app/api/employees \
  -H "Authorization: Bearer <TOKEN>"

# 4. Avatar upload (small PNG)
curl -X POST https://staffportal-kbwe.vercel.app/api/profile/avatar \
  -H "Authorization: Bearer <TOKEN>" \
  -F "avatar=@avatar.png;type=image/png"
#    -> {"avatarUrl":"https://res.cloudinary.com/<cloud>/image/upload/v.../avatars/..."}

# 5. The stored URL must come back from the profile and be publicly fetchable
curl https://staffportal-kbwe.vercel.app/api/profile -H "Authorization: Bearer <TOKEN>"
curl -I "<avatarUrl from step 4>"

# 6. Remove it again (signed Cloudinary destroy + field cleared)
curl -X DELETE https://staffportal-kbwe.vercel.app/api/profile/avatar \
  -H "Authorization: Bearer <TOKEN>"
```

In the browser: open https://hexaportal.vercel.app, log in, open DevTools →
Network, and confirm the requests go to `staffportal-kbwe.vercel.app/api/…` and
return **200** (not a CORS error).

### Tests and build (run before every push)

```bash
# API — start it first (cd backend && npm run dev), needs MongoDB reachable
cd backend
npm test            # 46 checks: auth, RBAC, 21 reads, writes, 404s,
                    # avatar upload/download/delete, data-integrity assertions
                    # (creates and deletes a throwaway "zzsmoketmp" user only)
npm run test:storage# 11 checks: the 503 responses when storage credentials
                    # are absent, and that the API survives them

# Frontend
cd frontend
npm run build       # must succeed (vite build)
npx eslint .        # baseline: 55 problems (46 errors, 9 warnings)
```

### Troubleshooting

| Symptom | Meaning |
|---|---|
| `No lockfile found … Could not determine the package manager` / `yarn` in the log | Install Command is still `yarn`. Set it to `npm ci` (§1). |
| `npm ci` "package.json and package-lock.json are not in sync" | A manifest changed without its lockfile. Run `npm install` locally and commit both files. |
| `Multer 1.x` deprecation/security warning in the log | Fixed: multer is now `^2.4.0` in both manifests and lockfiles. |
| `500 FUNCTION_INVOCATION_FAILED` | Function crashed — open Project → Logs. Should no longer happen; if it does, the stack trace now points at the real cause. |
| `503 Database is not connected yet…` | `MONGO_URI` missing/wrong, or the Atlas IP/network access list blocks Vercel. |
| `503 Avatar storage is Cloudinary but no credentials…` | `AVATAR_STORAGE=cloudinary` without the Cloudinary variables. |
| `503 Avatar upload is unavailable…` | No storage credentials at all (§4). |
| `401 Not authorized. No token.` | Login worked, but the request lacked `Authorization: Bearer …`. |
| `404 {"message":"Route not found"}` | Routing is healthy — that path simply does not exist. |
| `413 Image is too large` / `400 Only JPEG, PNG, and WebP images allowed` | Expected: multer limits are 2 MB and JPEG/PNG/WebP. |
| Browser CORS error | `FRONTEND_URL` does not list the exact frontend origin. |

---

## 6. Known limitations

* **Multer was upgraded 1.x → 2.4.0** (`^2.4.0`). The only consumer is
  `backend/middleware/upload.js`, which uses `memoryStorage()` + `.single()` —
  unchanged APIs — and the 46-check suite passes on the new version. Multer 1.x
  is deprecated by its maintainers ("patched in 2.x") even though `npm audit`
  does not list a CVE for `1.4.5-lts.2`.
* **`npm audit` still reports 10 vulnerabilities** in other transitive
  dependencies (express/`qs`/`proxy-addr`, `body-parser`, `mongoose` 8.24,
  `morgan`, `brace-expansion`, and `nodemon`/`chokidar` which is dev-only) —
  **5 moderate, 4 high, 1 critical**. Not touched by this change (fixes are
  semver-compatible: run `npm install` + `npm audit fix` in `backend/` when you
  want them, and re-run `npm test`).
* **No page in the UI calls the avatar API yet.** `profileAPI.uploadAvatar()` /
  `deleteAvatar()` exist in `frontend/src/services/api.js`, but `/profile` is not
  registered in `AppRoutes.jsx`, and the `Profile` page keeps a local preview in
  `localStorage` instead of calling the API. The API itself is fully working
  (verified end-to-end locally, both storage paths); wiring a profile page to it
  is a separate change.
* **Nothing was verified against a live Cloudinary account** — no credentials
  were available. The signing algorithm is verified against Cloudinary's own
  SDK, and the missing-credential paths are tested, but §5 steps 1 and 4–6 need
  your `CLOUDINARY_URL` (or the three separate variables) before they can pass.
* The repository is public, which includes `backend/.env` history
  (`JWT_SECRET`). Rotate the secret when you go live.
