const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── Avatar storage adapter ──────────────────────────────────────────────────
// Where an avatar image is persisted is decided at request time, never at
// module load time (writing to disk while the module is required is what
// crashed the serverless function with ENOENT on Vercel).
//
//   1. AVATAR_STORAGE env var, when set, forces the backend
//      ('cloudinary' | 'blob' | 'local')
//   2. Cloudinary credentials present  → Cloudinary  (preferred)
//   3. BLOB_READ_WRITE_TOKEN present   → Vercel Blob
//   4. running on Vercel, nothing configured → HTTP 503 that names the exact
//      environment variables to add. The process keeps running; the error is
//      reported, not swallowed.
//   5. otherwise (development)         → backend/uploads/avatars on disk,
//      served by the existing express.static('/uploads') route.
//
// Cloudinary calls use the public REST API with the official signing
// algorithm (sha1 over the sorted, non-empty "k=v" list + api_secret), so no
// extra dependency is introduced.

const LOCAL_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const CLOUDINARY_UPLOAD_URL = (cloud) =>
  `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;
const CLOUDINARY_DESTROY_URL = (cloud) =>
  `https://api.cloudinary.com/v1_1/${cloud}/destroy`;

class StorageNotConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageNotConfiguredError';
    this.status = 503;
  }
}

class StorageUpstreamError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'StorageUpstreamError';
    this.status = status;
  }
}

/** CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name> (or three vars). */
function cloudinaryCredentials() {
  const fromUrl = /^cloudinary:\/\/([^:/?#]+):([^@/?#]+)@([^/?#]+)/.exec(
    process.env.CLOUDINARY_URL || ''
  );
  if (fromUrl) {
    return { apiKey: fromUrl[1], apiSecret: fromUrl[2], cloud: fromUrl[3] };
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    return {
      cloud: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      apiSecret: CLOUDINARY_API_SECRET,
    };
  }
  return null;
}

/** Official Cloudinary request signature: sha1(sorted "k=v" + api_secret). */
function cloudinarySignature(params, apiSecret) {
  const toSign = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
    .sort()
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

function assertCloudinaryCredentials() {
  const creds = cloudinaryCredentials();
  if (!creds) {
    throw new StorageNotConfiguredError(
      'Avatar storage is Cloudinary but no credentials are configured. ' +
        'Set CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>) or the three ' +
        'variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
    );
  }
  return creds;
}

async function cloudinaryRequest(url, fields, action) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));

  let res;
  try {
    res = await fetch(url, { method: 'POST', body: form });
  } catch (err) {
    throw new StorageUpstreamError(`Cloudinary ${action} could not be reached: ${err.message}`);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const detail = body && (body.error && body.error.message) ? body.error.message : res.statusText;
    const code = body && body.error && body.error.code ? ` (${body.error.code})` : '';
    throw new StorageUpstreamError(`Cloudinary ${action} failed${code}: ${detail}`);
  }
  return body;
}

// 'cloudinary' | 'blob' | 'local' | 'unconfigured'
function activeBackend() {
  const forced = process.env.AVATAR_STORAGE;
  if (forced) return forced;
  if (cloudinaryCredentials()) return 'cloudinary';
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  if (process.env.VERCEL) return 'unconfigured'; // deployed, but no storage credentials
  return 'local';
}

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(url);
}

/**
 * Persist an uploaded avatar and return the URL that goes into the database.
 * @param {{ buffer: Buffer, mimetype: string, userId: string }} file
 * @returns {Promise<{ url: string, storage: string }>}
 */
async function storeAvatar({ buffer, mimetype, userId }) {
  const ext = EXT_BY_MIME[mimetype];
  if (!ext) {
    const err = new Error('Only JPEG, PNG, and WebP images allowed.');
    err.status = 400;
    throw err;
  }

  const filename = `avatar-${userId}-${Date.now()}${ext}`;
  const backend = activeBackend();

  if (backend === 'cloudinary') {
    const { cloud, apiKey, apiSecret } = assertCloudinaryCredentials();
    const publicId = `avatars/${filename.replace(new RegExp(`\\${ext}$`), '')}`;
    const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };

    const result = await cloudinaryRequest(
      CLOUDINARY_UPLOAD_URL(cloud),
      {
        // file and api_key are deliberately not part of the signature.
        file: `data:${mimetype};base64,${buffer.toString('base64')}`,
        api_key: apiKey,
        signature: cloudinarySignature(params, apiSecret),
        ...params,
      },
      'upload'
    );

    if (!result || !result.secure_url) {
      throw new StorageUpstreamError('Cloudinary upload returned no secure_url.');
    }
    return { url: result.secure_url, storage: 'cloudinary' };
  }

  if (backend === 'blob') {
    // Official SDK — reads BLOB_READ_WRITE_TOKEN from the environment.
    const { put } = require('@vercel/blob');
    const blob = await put(`avatars/${filename}`, buffer, {
      access: 'public',
      contentType: mimetype,
    });
    return { url: blob.url, storage: 'vercel-blob' };
  }

  if (backend === 'unconfigured') {
    throw new StorageNotConfiguredError(
      'Avatar upload is unavailable: no persistent storage is configured for this deployment. ' +
        'Either connect a Cloudinary account (set CLOUDINARY_URL) or a Vercel Blob store ' +
        '(set BLOB_READ_WRITE_TOKEN) in the project environment variables, then redeploy.'
    );
  }

  // Development / self-hosted: keep the original behaviour (disk + /uploads route).
  await fs.promises.mkdir(LOCAL_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(LOCAL_DIR, filename), buffer);
  return { url: `/uploads/avatars/${filename}`, storage: 'local' };
}

/** `https://res.cloudinary.com/<cloud>/image/upload/v12/avatars/avatar-x.png` → `avatars/avatar-x` */
function publicIdFromCloudinaryUrl(url) {
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const tail = url.slice(idx + marker.length);
  const withoutQuery = tail.split(/[?#]/)[0];
  const withoutVersion = withoutQuery.replace(/^v\d+\//, '');
  return withoutVersion.replace(/\.[A-Za-z0-9]+$/, '') || null;
}

/**
 * Remove a previously stored avatar. Never throws for files that are already
 * gone; does throw a clear 503 when remote deletion needs credentials that are
 * missing, and a 502 when the storage provider reports an error.
 * @param {string} url value previously returned by storeAvatar()
 * @returns {Promise<boolean>} true when something was removed
 */
async function removeAvatar(url) {
  if (!url) return false;

  if (!isRemoteUrl(url)) {
    // Local avatar: only ever touch files inside our own uploads folder.
    const target = path.resolve(path.join(__dirname, '..', url.replace(/^\//, '')));
    const root = path.resolve(path.join(__dirname, '..', 'uploads'));
    if (!target.startsWith(root + path.sep)) return false;
    try {
      await fs.promises.unlink(target);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  if (/res\.cloudinary\.com\//i.test(url)) {
    const { cloud, apiKey, apiSecret } = assertCloudinaryCredentials();
    const publicId = publicIdFromCloudinaryUrl(url);
    if (!publicId) {
      // Not fatal: the record is cleared, and the orphaned asset is logged.
      console.warn(`⚠️ Could not derive Cloudinary public_id from ${url}; asset left in place.`);
      return false;
    }
    const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
    const result = await cloudinaryRequest(
      CLOUDINARY_DESTROY_URL(cloud),
      { api_key: apiKey, signature: cloudinarySignature(params, apiSecret), ...params },
      'delete'
    );
    return result && result.result === 'ok';
  }

  // Any other remote avatar (Vercel Blob).
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new StorageNotConfiguredError(
      'Cannot delete this avatar: it is stored remotely and BLOB_READ_WRITE_TOKEN is not set.'
    );
  }
  const { del } = require('@vercel/blob');
  await del(url);
  return true;
}

module.exports = {
  storeAvatar,
  removeAvatar,
  activeBackend,
  cloudinaryCredentials,
  cloudinarySignature,
  publicIdFromCloudinaryUrl,
  StorageNotConfiguredError,
  StorageUpstreamError,
  LOCAL_DIR,
};
