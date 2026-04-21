// Google Drive backend — uses the user's own Drive appDataFolder.
// No dependencies on other app modules.
// Expects Google Identity Services (GIS) script to be loaded in index.html:
//   <script src="https://accounts.google.com/gsi/client" async defer></script>
//
// Each user's files live in THEIR OWN Drive under the hidden appDataFolder
// space; the developer cannot see or access them.

const GOOGLE_CLIENT_ID = '516350362687-tvhavv4e51batgt7a19gmbf2gab4ob8u.apps.googleusercontent.com';
const DRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_API        = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD     = 'https://www.googleapis.com/upload/drive/v3';

const TOKEN_CACHE_KEY = 'bm_drive_token';

let _tokenClient   = null;
let _accessToken   = null;
let _tokenExpiry   = 0;      // epoch ms
let _idCache       = {};     // { filename: driveFileId }
let _userEmail     = '';     // for display only

// Restore a cached token from localStorage if it's still valid.
(function _hydrateCachedToken() {
  try {
    const raw = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!raw) return;
    const { access_token, expiry, email } = JSON.parse(raw);
    if (!access_token || !expiry || Date.now() >= expiry) {
      localStorage.removeItem(TOKEN_CACHE_KEY);
      return;
    }
    _accessToken = access_token;
    _tokenExpiry = expiry;
    _userEmail   = email || '';
  } catch {}
})();

function _cacheToken() {
  try {
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify({
      access_token: _accessToken,
      expiry:       _tokenExpiry,
      email:        _userEmail,
    }));
  } catch {}
}

// ── GIS token handling ────────────────────────────────────────────────────

function _initTokenClient() {
  if (_tokenClient) return;
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services script not loaded');
  }
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope:     DRIVE_SCOPE,
    callback:  () => {},   // set per-request
  });
}

// Request a fresh token. `interactive=true` shows consent/chooser if needed;
// `false` attempts silent renew and resolves with null if blocked.
function _requestToken(interactive) {
  return new Promise((resolve) => {
    _initTokenClient();
    _tokenClient.callback = (resp) => {
      if (resp.error || !resp.access_token) { resolve(null); return; }
      _accessToken = resp.access_token;
      _tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000 - 60000;
      _cacheToken();
      resolve(resp.access_token);
    };
    try {
      _tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    } catch { resolve(null); }
  });
}

async function _ensureToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
  return _requestToken(false);
}

// ── Drive REST helpers ────────────────────────────────────────────────────

async function _driveFetch(url, opts = {}) {
  let tok = await _ensureToken();
  if (!tok) throw new Error('Drive not authenticated');

  const run = async (t) => fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${t}` },
  });

  let resp = await run(tok);
  if (resp.status === 401) {
    tok = await _requestToken(false);
    if (!tok) throw new Error('Drive re-auth failed');
    resp = await run(tok);
  }
  return resp;
}

async function _findIdByName(name) {
  const filename = _toDriveFilename(name);
  if (_idCache[filename]) return _idCache[filename];

  const q = encodeURIComponent(
    `name='${filename.replace(/'/g, "\\'")}' and 'appDataFolder' in parents and trashed=false`
  );
  const resp = await _driveFetch(
    `${DRIVE_API}/files?spaces=appDataFolder&q=${q}&fields=files(id,name)`
  );
  if (!resp.ok) return null;
  const { files } = await resp.json();
  if (!files || files.length === 0) return null;
  _idCache[filename] = files[0].id;
  return files[0].id;
}

function _toDriveFilename(name) {
  return (name || 'Profile').trim() + '.json';
}

async function _multipartUpload(filename, body, fileId) {
  const metadata = fileId
    ? { name: filename }
    : { name: filename, parents: ['appDataFolder'] };
  const boundary = '-------bmp' + Math.random().toString(36).slice(2);
  const multipart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    body + '\r\n' +
    `--${boundary}--`;

  const url = fileId
    ? `${DRIVE_UPLOAD}/files/${fileId}?uploadType=multipart`
    : `${DRIVE_UPLOAD}/files?uploadType=multipart`;

  const resp = await _driveFetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  if (!resp.ok) throw new Error(`Drive upload failed: ${resp.status}`);
  const json = await resp.json();
  _idCache[filename] = json.id;
  return json.id;
}

// ── Public connection funcs ───────────────────────────────────────────────

// Try silent auth (no popup). Returns 'granted' | 'needs-signin' | 'none'.
// 'none' means GIS script isn't loaded; 'needs-signin' means a user gesture is required.
async function driveRestore() {
  // Cached token still valid → skip Google entirely, no popup.
  if (_accessToken && Date.now() < _tokenExpiry) return 'granted';

  if (!window.google?.accounts?.oauth2) return 'none';
  const prev = localStorage.getItem('bm_drive_last_signin');
  if (!prev) return 'needs-signin';
  const tok = await _requestToken(false);
  if (!tok) return 'needs-signin';
  if (!_userEmail) await _loadUserEmail();
  return 'granted';
}

// Must be called from a user gesture (click). Returns true on success.
async function driveSignIn() {
  const tok = await _requestToken(true);
  if (!tok) return false;
  localStorage.setItem('bm_drive_last_signin', '1');
  await _loadUserEmail();
  return true;
}

function driveSignOut() {
  if (_accessToken && window.google?.accounts?.oauth2) {
    try { google.accounts.oauth2.revoke(_accessToken, () => {}); } catch {}
  }
  _accessToken = null;
  _tokenExpiry = 0;
  _idCache = {};
  _userEmail = '';
  localStorage.removeItem('bm_drive_last_signin');
  localStorage.removeItem(TOKEN_CACHE_KEY);
}

function driveIsSignedIn() { return !!_accessToken; }
function driveUserEmail()  { return _userEmail; }

async function _loadUserEmail() {
  try {
    const resp = await _driveFetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
    if (!resp.ok) return;
    const { user } = await resp.json();
    _userEmail = user?.emailAddress || '';
    _cacheToken();
  } catch {}
}

// ── DriveBackend file-ops (same surface as LocalBackend) ──────────────────

const DriveBackend = {
  kind: 'drive',

  async readProfileFile(name) {
    const id = await _findIdByName(name);
    if (!id) return null;
    try {
      const resp = await _driveFetch(`${DRIVE_API}/files/${id}?alt=media`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  },

  async writeProfileFile(name, data) {
    const filename = _toDriveFilename(name);
    const id = await _findIdByName(name);
    const body = JSON.stringify(data, null, 2);
    try { await _multipartUpload(filename, body, id || null); }
    catch (e) { console.error('bookmarks: Drive write failed for', name, e); }
  },

  async deleteProfileFile(name) {
    const id = await _findIdByName(name);
    if (!id) return;
    try {
      await _driveFetch(`${DRIVE_API}/files/${id}`, { method: 'DELETE' });
      delete _idCache[_toDriveFilename(name)];
    } catch {}
  },

  async renameProfileFile(oldName, newName) {
    const id = await _findIdByName(oldName);
    if (!id) return;
    try {
      const resp = await _driveFetch(`${DRIVE_API}/files/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: _toDriveFilename(newName) }),
      });
      if (resp.ok) {
        delete _idCache[_toDriveFilename(oldName)];
        _idCache[_toDriveFilename(newName)] = id;
      }
    } catch {}
  },

  async listProfileFiles() {
    try {
      const resp = await _driveFetch(
        `${DRIVE_API}/files?spaces=appDataFolder&pageSize=1000&fields=files(id,name)`
      );
      if (!resp.ok) return [];
      const { files } = await resp.json();
      const names = [];
      for (const f of files || []) {
        if (!f.name.endsWith('.json') || f.name.startsWith('_')) continue;
        _idCache[f.name] = f.id;
        names.push(f.name.slice(0, -5));
      }
      return names.sort();
    } catch { return []; }
  },

  async readOrderFile() {
    const id = await _findIdByName('_order');
    if (!id) return null;
    try {
      const resp = await _driveFetch(`${DRIVE_API}/files/${id}?alt=media`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  },

  async writeOrderFile(names) {
    const filename = '_order.json';
    const id = await _findIdByName('_order');
    try { await _multipartUpload(filename, JSON.stringify(names, null, 2), id || null); }
    catch (e) { console.error('bookmarks: Drive order write failed', e); }
  },

  // No legacy single-file format in Drive — never existed there.
  async readLegacyFile() { return null; },
  async deleteLegacyFile() {},
};
