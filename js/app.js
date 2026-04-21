// Entry point — depends on all other modules being loaded first.
// Load order: utils → state → filestore → drivestore → storage → render →
//             actions → modal → profiles → categories → app

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeProfileModal(); }
});

document.addEventListener('click', () => closeProfileDropdown());

const BACKEND_PREF_KEY = 'bm_backend';   // 'local' | 'drive'

async function loadAndRender() {
  await loadProfiles();
  renderCategoryPills();
  renderBookmarks();
  updateProfileDisplay();
}

// ── Local folder path ─────────────────────────────────────────────────────

async function handleChooseFolder() {
  const errEl = document.getElementById('first-run-err');
  const ok = await chooseFolder();
  if (!ok) { errEl.textContent = 'No folder was selected. Please try again.'; return; }
  errEl.textContent = '';
  setActiveBackend(LocalBackend);
  localStorage.setItem(BACKEND_PREF_KEY, 'local');
  document.getElementById('first-run').style.display = 'none';
  await loadAndRender();
}

// ── Google Drive path ─────────────────────────────────────────────────────

function _waitForGis(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function check() {
      if (window.google?.accounts?.oauth2) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(check, 100);
    })();
  });
}

async function handleDriveSignIn() {
  const errEl = document.getElementById('first-run-err');
  const gisReady = await _waitForGis();
  if (!gisReady) { errEl.textContent = 'Google sign-in library failed to load. Check your network.'; return; }

  const ok = await driveSignIn();
  if (!ok) { errEl.textContent = 'Sign-in was cancelled or denied.'; return; }
  errEl.textContent = '';

  const prev = localStorage.getItem(BACKEND_PREF_KEY);
  const hadLocal = prev === 'local' && LocalBackend && (typeof _dirHandle !== 'undefined') && _dirHandle;

  setActiveBackend(DriveBackend);
  localStorage.setItem(BACKEND_PREF_KEY, 'drive');

  // If we were previously using local storage, migrate existing data up to Drive.
  if (hadLocal) {
    const migrated = await _migrateLocalToDrive();
    if (migrated > 0) console.log(`bookmarks: migrated ${migrated} profile file(s) to Drive`);
  }

  document.getElementById('first-run').style.display = 'none';
  await loadAndRender();
}

// Copy every local profile JSON + _order.json up to Drive. Returns file count.
async function _migrateLocalToDrive() {
  let count = 0;
  try {
    const names = await LocalBackend.listProfileFiles();
    for (const n of names) {
      const data = await LocalBackend.readProfileFile(n);
      if (data) { await DriveBackend.writeProfileFile(n, data); count++; }
    }
    const order = await LocalBackend.readOrderFile();
    if (order) await DriveBackend.writeOrderFile(order);
  } catch (e) { console.error('bookmarks: migration to Drive failed', e); }
  return count;
}

// ── Reconnect overlay (works for both backends) ───────────────────────────

async function handleReconnect() {
  const errEl = document.getElementById('reconnect-err');
  const pref = localStorage.getItem(BACKEND_PREF_KEY);

  if (pref === 'drive') {
    const ok = await driveSignIn();
    if (!ok) { errEl.textContent = 'Sign-in was cancelled.'; return; }
    setActiveBackend(DriveBackend);
  } else {
    const ok = await reconnectFolder();
    if (!ok) { errEl.textContent = 'Permission was not granted. Please try again.'; return; }
    setActiveBackend(LocalBackend);
  }
  errEl.textContent = '';
  document.getElementById('reconnect').style.display = 'none';
  await loadAndRender();
}

function _showReconnectOverlay(kind) {
  const title = document.getElementById('reconnect-title');
  const msg   = document.getElementById('reconnect-msg');
  const hint  = document.getElementById('reconnect-hint');
  const btn   = document.getElementById('reconnect-btn');
  if (kind === 'drive') {
    title.textContent = 'Reconnect to Google Drive';
    msg.innerHTML     = 'Your sign-in session has expired.';
    hint.textContent  = 'Click below to sign in again and resume where you left off.';
    btn.textContent   = 'Sign in with Google';
  } else {
    title.textContent = 'Reconnect to Storage Folder';
    msg.innerHTML     = 'Reconnecting to <code>' + (getFolderName() || '') + '</code>';
    hint.textContent  = 'Browsers require a click to re-authorize folder access after each page reload.';
    btn.textContent   = 'Reconnect';
  }
  document.getElementById('reconnect').style.display = 'flex';
}

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const pref = localStorage.getItem(BACKEND_PREF_KEY);

  if (pref === 'drive') {
    // Fast path: cached token is still valid — render immediately, skip GIS wait.
    if (driveHasCachedToken()) {
      setActiveBackend(DriveBackend);
      await loadAndRender();
      return;
    }
    const gisReady = await _waitForGis();
    const state = gisReady ? await driveRestore() : 'needs-signin';
    if (state === 'granted') { setActiveBackend(DriveBackend); await loadAndRender(); return; }
    _showReconnectOverlay('drive');
    return;
  }

  // Default: local folder (existing users)
  const state = await restoreHandle();
  if (state === 'granted')          { setActiveBackend(LocalBackend); await loadAndRender(); return; }
  if (state === 'needs-permission') { _showReconnectOverlay('local'); return; }
  document.getElementById('first-run').style.display = 'flex';
}

init();
