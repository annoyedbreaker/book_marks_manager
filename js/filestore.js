// Pure storage layer — no dependencies on other app modules.
// Two backends live here:
//   • LocalBackend  — File System Access API (folder the user picks)
//   • (DriveBackend is defined in drivestore.js)
//
// `activeBackend` is set during init (app.js) to whichever one is in use.
// Top-level read/write/rename/list/delete dispatch to activeBackend.

let _dirHandle = null;
let activeBackend = null;   // set to LocalBackend or DriveBackend after connect

// ── IndexedDB helpers ─────────────────────────────────────────────────────
function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('bm_storage', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function _getHandle() {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('handles').objectStore('handles').get('dir');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function _putHandle(handle) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'dir');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ── Filename helpers ──────────────────────────────────────────────────────
function _sanitize(name) {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'Profile';
}
function _toFilename(name) { return _sanitize(name) + '.json'; }

// ── LocalBackend connection funcs (called directly from app.js) ───────────

async function restoreHandle() {
  let handle = null;
  try { handle = await _getHandle(); } catch { return 'none'; }
  if (!handle) return 'none';
  _dirHandle = handle;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    return perm === 'granted' ? 'granted' : 'needs-permission';
  } catch {
    return 'needs-permission';
  }
}

async function reconnectFolder() {
  if (!_dirHandle) return false;
  try {
    const perm = await _dirHandle.requestPermission({ mode: 'readwrite' });
    return perm === 'granted';
  } catch { return false; }
}

async function chooseFolder() {
  try {
    const handle = await showDirectoryPicker({ mode: 'readwrite' });
    await _putHandle(handle);
    _dirHandle = handle;
    return true;
  } catch { return false; }
}

function getFolderName() { return _dirHandle ? _dirHandle.name : ''; }

// ── LocalBackend file-ops ─────────────────────────────────────────────────

const LocalBackend = {
  kind: 'local',

  async readProfileFile(name) {
    if (!_dirHandle) return null;
    try {
      const fh = await _dirHandle.getFileHandle(_toFilename(name));
      return JSON.parse(await (await fh.getFile()).text());
    } catch { return null; }
  },

  async writeProfileFile(name, data) {
    if (!_dirHandle) return;
    try {
      const fh = await _dirHandle.getFileHandle(_toFilename(name), { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(data, null, 2));
      await w.close();
    } catch (e) { console.error('bookmarks: write failed for', name, e); }
  },

  async deleteProfileFile(name) {
    if (!_dirHandle) return;
    try { await _dirHandle.removeEntry(_toFilename(name)); } catch { }
  },

  async renameProfileFile(oldName, newName) {
    const data = await this.readProfileFile(oldName);
    if (data !== null) await this.writeProfileFile(newName, data);
    await this.deleteProfileFile(oldName);
  },

  async listProfileFiles() {
    if (!_dirHandle) return [];
    const names = [];
    for await (const [filename, handle] of _dirHandle.entries()) {
      if (handle.kind === 'file' && filename.endsWith('.json') && !filename.startsWith('_')) {
        names.push(filename.slice(0, -5));
      }
    }
    return names.sort();
  },

  async readOrderFile() {
    if (!_dirHandle) return null;
    try {
      const fh = await _dirHandle.getFileHandle('_order.json');
      return JSON.parse(await (await fh.getFile()).text());
    } catch { return null; }
  },

  async writeOrderFile(names) {
    if (!_dirHandle) return;
    try {
      const fh = await _dirHandle.getFileHandle('_order.json', { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(names, null, 2));
      await w.close();
    } catch (e) { console.error('bookmarks: order file write failed', e); }
  },

  async readLegacyFile() {
    if (!_dirHandle) return null;
    try {
      const fh = await _dirHandle.getFileHandle('bookmarks.json');
      return JSON.parse(await (await fh.getFile()).text());
    } catch { return null; }
  },

  async deleteLegacyFile() {
    if (!_dirHandle) return;
    try { await _dirHandle.removeEntry('bookmarks.json'); } catch { }
  },
};

// ── Dispatchers used by storage.js / profiles.js ──────────────────────────

function readProfileFile(name)          { return activeBackend.readProfileFile(name); }
function writeProfileFile(name, data)   { return activeBackend.writeProfileFile(name, data); }
function deleteProfileFile(name)        { return activeBackend.deleteProfileFile(name); }
function renameProfileFile(oldN, newN)  { return activeBackend.renameProfileFile(oldN, newN); }
function listProfileFiles()             { return activeBackend.listProfileFiles(); }
function readOrderFile()                { return activeBackend.readOrderFile(); }
function writeOrderFile(names)          { return activeBackend.writeOrderFile(names); }
function readLegacyFile()               { return activeBackend.readLegacyFile?.() ?? Promise.resolve(null); }
function deleteLegacyFile()             { return activeBackend.deleteLegacyFile?.() ?? Promise.resolve(); }

function setActiveBackend(b) { activeBackend = b; }
function getActiveBackendKind() { return activeBackend ? activeBackend.kind : null; }
