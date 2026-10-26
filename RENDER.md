# Staff Portal — Render deployment (backend)

The backend is a plain Express + Mongoose server (`backend/server.js`). Render
runs it as a long-lived web service, so the process itself listens on the port
Render assigns — no serverless wrapper involved. (`api/app.js` + `vercel.json`
are the Vercel serverless entry point; Render ignores them, so both setups can
coexist in this repository.)

---

## 1. Service settings

**Render Dashboard → Service → Settings → General**

| Setting | Value | Why |
|---|---|---|
| Runtime | `Node` | Express API |
| **Root Directory** | `backend` | The API's own `package.json` / `package-lock.json` live here, so npm installs exactly the locked dependency tree. |
| **Build Command** | `npm install` | npm only — there is **no `yarn.lock`** in the repository (only `package-lock.json`), so `yarn` prints `No lockfile found` and warns about the foreign lockfile. Use `npm ci` instead if you want a strictly reproducible install that fails loudly on a manifest/lockfile mismatch. |
| **Start Command** | `npm start` | Resolves to `node server.js` (`backend/package.json` → `scripts.start`). |
| **Health Check Path** | `/api/health` | Returns HTTP 200 with the real database state (see §4). |

Node version: the service reads `backend/.nvmrc` (`24.21.0`). You can also pin it
explicitly with the `NODE_VERSION` environment variable (below).

### Alternative: Root Directory left at the repository root

If you prefer not to set a Root Directory, use the repository root instead:

| Setting | Value |
|---|---|
| Build Command | `npm install` (installs the npm workspace, which includes `backend`) |
| Start Command | `npm run start --workspace backend` |

Do **not** use `node server.js` with the root directory — `server.js` is not at
the repository root, and the process would fail immediately after the build
succeeded. The `backend` Root Directory (§1 table) is the simpler option.

---

## 2. Environment variables

Render Dashboard → Service → **Environment**. Set them for the **Environment**
your service runs in. Never hard-code credentials in the source, and note that
`backend/.env` is *not* deployed (it is git-ignored) — these values are the only
ones the service sees.

| Name | Required | Value | Notes |
|---|---|---|---|
| `MONGO_URI` | ✅ | `mongodb+srv://<user>:<pass>@<cluster>/<db>` | MongoDB Atlas connection string. `MONGODB_URI` is accepted as an alias — set **one** of the two, never both. |
| `JWT_SECRET` | ✅ | a long random string | Signs auth tokens. **Rotate it**: the old value was committed to this public repository in `backend/.env` history. |
| `FRONTEND_URL` | ✅ | `https://hexaportal.vercel.app,https://staffportal-hx6zg5sd0-hexa-branding.vercel.app` | Comma-separated CORS allow-list of **deployed frontend origins**. `http://localhost:5173` / `:4173` are always allowed for local dev, so they no longer need to be listed. A blocked origin is logged as `⛔ CORS blocked origin: …` in the Render logs. |
| `NODE_VERSION` | optional | `24.21.0` | Pins Node; `backend/.nvmrc` already does this. |
| `NODE_ENV` | optional | `production` | Keeps stack traces out of API error responses. |
| `JWT_EXPIRES_IN` | optional | `7d` | Default when unset. |
| `PORT` | ⛔ omit | *(unset)* | **Render assigns it.** The server reads `process.env.PORT` and binds `0.0.0.0`, so setting it yourself only fights the platform. |
| `CLOUDINARY_URL` | optional | `cloudinary://<key>:<secret>@<cloud>` | Preferred avatar storage. Without it, avatars fall back to local disk — which Render's filesystem **resets on every deploy**, so set Cloudinary in production. |
| `AVATAR_STORAGE` | optional | `cloudinary` \| `local` | Force a storage backend instead of auto-detecting. |

---

## 3. MongoDB Atlas network access (the usual cause of "build fine, no data")

A successful Render build says nothing about the database. In **MongoDB Atlas →
Network Access**, make sure Render's egress IPs are allowed — the simplest test
is `0.0.0.0/0` (IPv4), then restrict it later. If Atlas blocks Render, the
service starts fine and every database route answers `503`, with the logs
showing a `querySrvETIMEDOUT` / `ETIMEDOUT` hint.

---

## 4. What the server now guarantees

* Listens on `0.0.0.0:$PORT` **immediately**, so Render's deploy health check
  passes even while Atlas is still warming up (a cold Atlas cluster used to risk
  a deploy timeout, because the old code only called `app.listen()` *after* the
  database connected).
* Reads the connection string from `MONGO_URI` **or** `MONGODB_URI`, never from
  source; logs only a credential-masked host (`mongodb+srv://<credentials>@…`).
* **Never reports a connection it does not have.** `/api/health` reads
  `mongoose.connection.readyState` directly, and `middleware/auth.js` answers
  `503 Database is not connected yet` until it is `1`.
* Retries the connection with a capped backoff instead of `process.exit(1)`, so
  a transient Atlas blip produces retry logs rather than a restart loop that
  hides the real error.
* Prints actionable hints for the three real-world failures: DNS/SRV typo,
  rejected credentials, and a blocked IP.
* Shuts down gracefully on `SIGTERM` (Render recycles instances with it).

---

## 5. Verifying the deployment

```bash
# 1. Health — must report db:"connected"
curl https://<your-service>.onrender.com/api/health
#    ...,"db":"connected","storage":"cloudinary",...

# 2. Login
curl -X POST https://<your-service>.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 3. Protected route (paste the token from step 2)
curl https://<your-service>.onrender.com/api/employees \
  -H "Authorization: Bearer <TOKEN>"
```

`"db":"disconnected"` with a 503 on step 3 means the API is up but Atlas is not
reachable or the URI is wrong — read the Render logs for the printed hint.

### Frontend

The React app still reads `VITE_API_URL` at **build** time. Point it at the
Render URL and redeploy the frontend, otherwise the browser keeps calling the
old Vercel backend:

```
VITE_API_URL=https://<your-service>.onrender.com/api
```

And set `FRONTEND_URL` on Render to the exact frontend origin, or the browser
reports a CORS error.

---

## 6. Security: untrack `backend/.env`

`backend/.env` is **committed to this public repository** and contains real
credentials. `.gitignore` now excludes it, but an ignored file that is already
tracked stays tracked. Run this once, then rotate the secrets:

```bash
git rm --cached backend/.env
git commit -m "Stop tracking backend/.env (secrets)"
git push origin main
```

Then, in MongoDB Atlas → Database Access, change the database user's password;
in the Render dashboard, set the new `MONGO_URI` and a fresh `JWT_SECRET`.
(File history still contains the old values, so rotating is not optional.)
