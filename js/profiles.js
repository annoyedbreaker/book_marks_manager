// Depends on: state.js (chromeProfiles, activeChromeProfileId, profiles, activeProfileId,
//                        activeCategory),
//             storage.js (_hydrateFromActiveProfile, _saveActiveProfile,
//                         _saveActiveProfileId, _saveActiveChromeProfileId,
//                         _writeChromeProfileFile, ACTIVE_CP_KEY),
//             filestore.js (chooseFolder, getFolderName, writeProfileFile,
//                           deleteProfileFile, renameProfileFile, writeOrderFile),
//             render.js (renderCategoryPills, renderBookmarks),
//             utils.js (esc, uid)

// ── ChromeProfile switch ──────────────────────────────────────────────────

function switchChromeProfile(id) {
  if (id === activeChromeProfileId) return;
  activeChromeProfileId = id;
  _saveActiveChromeProfileId();
  const cp = chromeProfiles.find(c => c.id === id);
  activeProfileId = cp?.profiles[0]?.id || null;
  if (activeProfileId) _saveActiveProfileId();
  _hydrateFromActiveProfile();
  renderCategoryPills();
  renderBookmarks();
  updateProfileDisplay();
  renderProfileModal();
}

// ── BMP CRUD ──────────────────────────────────────────────────────────────

function switchProfile(id) {
  if (id === activeProfileId) { closeProfileDropdown(); return; }
  activeProfileId = id;
  _saveActiveProfileId();
  _hydrateFromActiveProfile();
  closeProfileDropdown();
  renderCategoryPills();
  renderBookmarks();
  updateProfileDisplay();
}

function createProfile(name, chromeProfileId) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const cp = chromeProfiles.find(c => c.id === chromeProfileId);
  if (!cp) return;
  const bmp = {
    id: uid(), name: trimmed,
    bookmarks: [], customCategories: [], categoryOrder: [],
  };
  const defaultIdx = cp.profiles.findIndex(p => p.isDefault);
  if (defaultIdx === -1) cp.profiles.push(bmp);
  else cp.profiles.splice(defaultIdx, 0, bmp);
  profiles = chromeProfiles.flatMap(c => c.profiles);
  _writeChromeProfileFile(cp).catch(console.error);
  renderProfileModal();
}

function renameProfile(id, newName) {
  const trimmed = newName.trim();
  if (!trimmed) return;
  const bmp = profiles.find(p => p.id === id);
  if (!bmp || bmp.isDefault || bmp.name === trimmed) return;
  bmp.name = trimmed;
  const cp = chromeProfiles.find(c => c.profiles.some(p => p.id === id));
  if (cp) _writeChromeProfileFile(cp).catch(console.error);
  renderProfileModal();
  updateProfileDisplay();
}

function deleteProfile(id) {
  const cp = chromeProfiles.find(c => c.profiles.some(p => p.id === id));
  if (!cp) return;
  const bmp = cp.profiles.find(p => p.id === id);
  if (!bmp || bmp.isDefault) return;
  cp.profiles = cp.profiles.filter(p => p.id !== id);
  profiles = chromeProfiles.flatMap(c => c.profiles);
  _writeChromeProfileFile(cp).catch(console.error);
  if (activeProfileId === id) {
    const newBmp = cp.profiles[0] || null;
    activeProfileId = newBmp?.id || null;
    if (activeProfileId) _saveActiveProfileId();
    _hydrateFromActiveProfile();
    renderCategoryPills();
    renderBookmarks();
    updateProfileDisplay();
  }
  renderProfileModal();
}

// ── Copy local storage up to Google Drive (on demand) ────────────────────
async function copyLocalToDrive() {
  const statusEl = document.getElementById('copy-to-drive-status');
  const btn      = document.getElementById('btn-copy-to-drive');
  const setStatus = (msg, isErr) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('err', !!isErr);
  };

  if (getActiveBackendKind() !== 'local') { setStatus('Already on Drive.'); return; }
  if (!confirm('Copy all local profiles up to your Google Drive? Existing Drive files with the same name will be overwritten.')) return;

  if (btn) btn.disabled = true;
  setStatus('Signing in…');

  if (!driveIsSignedIn()) {
    const ok = await driveSignIn();
    if (!ok) { setStatus('Sign-in cancelled.', true); if (btn) btn.disabled = false; return; }
  }

  try {
    setStatus('Copying…');
    let count = 0;
    const names = await LocalBackend.listProfileFiles();
    for (const n of names) {
      const data = await LocalBackend.readProfileFile(n);
      if (data) { await DriveBackend.writeProfileFile(n, data); count++; }
    }
    const order = await LocalBackend.readOrderFile();
    if (order) await DriveBackend.writeOrderFile(order);
    setStatus(`✓ Copied ${count} profile${count !== 1 ? 's' : ''} to Drive.`);
  } catch (e) {
    console.error(e);
    setStatus('Copy failed. Check console.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Change storage backend ────────────────────────────────────────────────
// Offers the user a choice between re-picking the local folder or switching to Drive.
async function changeDataFolder() {
  const current = getActiveBackendKind();
  const choice = prompt(
    'Storage options:\n' +
    '  1 — Local folder (pick a folder on this computer)\n' +
    '  2 — Google Drive (sync across devices)\n\n' +
    `Currently: ${current === 'drive' ? 'Google Drive' : 'Local folder'}\n\n` +
    'Enter 1 or 2:'
  );
  if (choice === '1') {
    const ok = await chooseFolder();
    if (!ok) return;
    setActiveBackend(LocalBackend);
    localStorage.setItem('bm_backend', 'local');
  } else if (choice === '2') {
    const ok = await driveSignIn();
    if (!ok) return;
    setActiveBackend(DriveBackend);
    localStorage.setItem('bm_backend', 'drive');
  } else {
    return;
  }
  await loadProfiles();
  renderCategoryPills();
  renderBookmarks();
  updateProfileDisplay();
  renderProfileModal();
}

// ── Header dropdown ───────────────────────────────────────────────────────
function toggleProfileDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('profile-dropdown');
  if (dd.classList.contains('open')) { closeProfileDropdown(); return; }
  renderProfileDropdownContent();
  dd.classList.add('open');
}

function closeProfileDropdown() {
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.classList.remove('open');
}

function renderProfileDropdownContent() {
  const dd = document.getElementById('profile-dropdown');
  const cp = chromeProfiles.find(c => c.id === activeChromeProfileId);
  if (!cp || cp.profiles.length === 0) {
    dd.innerHTML = `<span class="profile-dd-empty">No profiles yet</span>`;
    return;
  }
  dd.innerHTML = cp.profiles.map(bmp => `
    <button class="profile-dd-item${bmp.id === activeProfileId ? ' active' : ''}"
            onclick="switchProfile('${bmp.id}')">
      <span class="profile-dd-name">${esc(bmp.name)}</span>
    </button>`).join('');
}

// ── Profile modal ─────────────────────────────────────────────────────────
function openProfileModal() {
  closeProfileDropdown();
  renderProfileModal();
  document.getElementById('profile-modal').style.display = 'flex';
}

function closeProfileModal() {
  document.getElementById('profile-modal').style.display = 'none';
  deleteBmpConfirmId = null;
  cmState = null;
}

function profileOverlayClick(e) {
  if (e.target === document.getElementById('profile-modal')) closeProfileModal();
}

let deleteBmpConfirmId = null;

// ── Copy / Move BMP across Chrome profiles ────────────────────────────────
// Inline panel state: { id, action: 'copy'|'move', phase: 'pick'|'collision'|'rename',
//                       targetCpId, targetIsDefault, renameValue, error }
let cmState = null;

function _cloneBmpData(bmp) {
  return {
    bookmarks:        JSON.parse(JSON.stringify(bmp.bookmarks || [])),
    customCategories: [...(bmp.customCategories || [])],
    categoryOrder:    [...(bmp.categoryOrder || [])],
    lastCategory:     bmp.lastCategory || 'All',
  };
}

function _insertBmpBeforeDefault(cp, bmp) {
  const defaultIdx = cp.profiles.findIndex(p => p.isDefault);
  if (defaultIdx === -1) cp.profiles.push(bmp);
  else cp.profiles.splice(defaultIdx, 0, bmp);
}

// Applies source data onto the target CP. Returns:
//   { status: 'done' }                             on success
//   { status: 'collision', targetIsDefault: bool } if a BMP with the same name exists
function _applyCopy(source, targetCp, mode, newName) {
  const name = (mode === 'rename' && newName) ? newName.trim() : source.name;
  if (!name) return { status: 'collision', targetIsDefault: false };

  const existing = targetCp.profiles.find(p => p.name === name);
  if (existing && mode !== 'overwrite' && mode !== 'rename') {
    return { status: 'collision', targetIsDefault: existing.isDefault === true };
  }
  if (existing && mode === 'rename') {
    // rename collided again with another existing name — caller should retry
    return { status: 'collision', targetIsDefault: existing.isDefault === true };
  }

  const cloned = _cloneBmpData(source);

  if (existing && mode === 'overwrite') {
    existing.bookmarks        = cloned.bookmarks;
    existing.customCategories = cloned.customCategories;
    existing.categoryOrder    = cloned.categoryOrder;
    existing.lastCategory     = cloned.lastCategory;
    // preserve existing.id, existing.name, existing.isDefault
  } else {
    _insertBmpBeforeDefault(targetCp, {
      id: uid(),
      name,
      ...cloned,
    });
  }
  return { status: 'done' };
}

function copyBmpTo(sourceBmpId, targetCpId, mode, newName) {
  const source  = profiles.find(p => p.id === sourceBmpId);
  const targetCp = chromeProfiles.find(c => c.id === targetCpId);
  if (!source || !targetCp) return { status: 'error', error: 'Invalid source or target.' };

  const result = _applyCopy(source, targetCp, mode, newName);
  if (result.status !== 'done') return result;

  profiles = chromeProfiles.flatMap(c => c.profiles);
  _writeChromeProfileFile(targetCp).catch(console.error);
  return { status: 'done' };
}

function moveBmpTo(sourceBmpId, targetCpId, mode, newName) {
  const source = profiles.find(p => p.id === sourceBmpId);
  if (!source) return { status: 'error', error: 'Invalid source.' };
  if (source.isDefault) return { status: 'error', error: 'The Default profile cannot be moved.' };

  const sourceCp = chromeProfiles.find(c => c.profiles.some(p => p.id === sourceBmpId));
  const targetCp = chromeProfiles.find(c => c.id === targetCpId);
  if (!sourceCp || !targetCp) return { status: 'error', error: 'Invalid source or target.' };
  if (sourceCp.id === targetCp.id) return { status: 'error', error: 'Source and target are the same.' };

  const result = _applyCopy(source, targetCp, mode, newName);
  if (result.status !== 'done') return result;

  sourceCp.profiles = sourceCp.profiles.filter(p => p.id !== sourceBmpId);
  profiles = chromeProfiles.flatMap(c => c.profiles);

  // If the moved BMP was active, fall back to the first remaining BMP in the source CP.
  if (activeProfileId === sourceBmpId) {
    activeProfileId = sourceCp.profiles[0]?.id || null;
    if (activeProfileId) _saveActiveProfileId();
    _hydrateFromActiveProfile();
    renderCategoryPills();
    renderBookmarks();
    updateProfileDisplay();
  }

  _writeChromeProfileFile(sourceCp).catch(console.error);
  _writeChromeProfileFile(targetCp).catch(console.error);
  return { status: 'done' };
}

// ── Copy/Move UI handlers ────────────────────────────────────────────────
function openCopyMovePanel(bmpId, action) {
  if (cmState && cmState.id === bmpId && cmState.action === action) {
    cmState = null;
  } else {
    const otherCps = chromeProfiles.filter(c => c.id !== activeChromeProfileId);
    cmState = {
      id: bmpId,
      action,
      phase: 'pick',
      targetCpId: otherCps[0]?.id || '',
      targetIsDefault: false,
      renameValue: '',
      error: '',
    };
  }
  renderProfileModal();
}

function closeCopyMovePanel() { cmState = null; renderProfileModal(); }

function cmSelectTarget(cpId) {
  if (!cmState) return;
  cmState.targetCpId = cpId;
}

function cmGo() {
  if (!cmState) return;
  const fn = cmState.action === 'copy' ? copyBmpTo : moveBmpTo;
  const result = fn(cmState.id, cmState.targetCpId, null, null);
  _handleCmResult(result);
}

function cmOverwrite() {
  if (!cmState) return;
  const fn = cmState.action === 'copy' ? copyBmpTo : moveBmpTo;
  const result = fn(cmState.id, cmState.targetCpId, 'overwrite', null);
  _handleCmResult(result);
}

function cmStartRename() {
  if (!cmState) return;
  const src = profiles.find(p => p.id === cmState.id);
  cmState.phase = 'rename';
  cmState.renameValue = (src?.name || '') + ' (copy)';
  renderProfileModal();
  const input = document.getElementById('cm-rename-input');
  if (input) { input.focus(); input.select(); }
}

function cmConfirmRename() {
  if (!cmState) return;
  const input = document.getElementById('cm-rename-input');
  const name = (input?.value || '').trim();
  if (!name) { cmState.error = 'Name is required.'; renderProfileModal(); return; }
  const fn = cmState.action === 'copy' ? copyBmpTo : moveBmpTo;
  const result = fn(cmState.id, cmState.targetCpId, 'rename', name);
  if (result.status === 'collision') {
    cmState.error = `"${name}" also exists. Try another name.`;
    cmState.renameValue = name;
    renderProfileModal();
    return;
  }
  _handleCmResult(result);
}

function _handleCmResult(result) {
  if (result.status === 'done') {
    cmState = null;
    renderProfileModal();
    return;
  }
  if (result.status === 'collision') {
    cmState.phase = 'collision';
    cmState.targetIsDefault = result.targetIsDefault === true;
    cmState.error = '';
    renderProfileModal();
    return;
  }
  cmState.error = result.error || 'Something went wrong.';
  renderProfileModal();
}

function _cmPanelHTML(bmp) {
  if (!cmState || cmState.id !== bmp.id) return '';
  const otherCps = chromeProfiles.filter(c => c.id !== activeChromeProfileId);
  const verb = cmState.action === 'copy' ? 'Copy' : 'Move';
  const err = cmState.error ? `<span class="bmp-cm-status err">${esc(cmState.error)}</span>` : '';

  if (cmState.phase === 'pick') {
    if (otherCps.length === 0) {
      return `<div class="bmp-cm-panel">
        <span class="bmp-cm-status">No other Chrome profile to ${verb.toLowerCase()} to.</span>
        <div class="bmp-cm-row">
          <button class="btn-profile-action" onclick="closeCopyMovePanel()">Close</button>
        </div>
      </div>`;
    }
    return `<div class="bmp-cm-panel">
      <div class="bmp-cm-row">
        <label class="profile-folder-label">${verb} to:</label>
        <select class="cp-select" onchange="cmSelectTarget(this.value)">
          ${otherCps.map(c => `<option value="${c.id}"${c.id === cmState.targetCpId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
        <button class="btn-profile-action btn-rename" onclick="cmGo()">Go</button>
        <button class="btn-profile-action" onclick="closeCopyMovePanel()">Cancel</button>
      </div>
      ${err}
    </div>`;
  }

  if (cmState.phase === 'collision') {
    const targetCp = chromeProfiles.find(c => c.id === cmState.targetCpId);
    const msg = cmState.targetIsDefault
      ? `"${esc(targetCp?.name || '')}" already has a locked Default. Overwrite?`
      : `"${esc(targetCp?.name || '')}" already has a profile named "${esc(bmp.name)}".`;
    return `<div class="bmp-cm-panel">
      <span class="bmp-cm-status">${msg}</span>
      <div class="bmp-cm-row">
        <button class="btn-profile-action btn-danger" onclick="cmOverwrite()">Overwrite</button>
        ${cmState.targetIsDefault ? '' : `<button class="btn-profile-action btn-rename" onclick="cmStartRename()">Rename</button>`}
        <button class="btn-profile-action" onclick="closeCopyMovePanel()">Cancel</button>
      </div>
      ${err}
    </div>`;
  }

  if (cmState.phase === 'rename') {
    return `<div class="bmp-cm-panel">
      <div class="bmp-cm-row">
        <input class="profile-name-input" id="cm-rename-input" value="${esc(cmState.renameValue)}"
               onkeydown="if(event.key==='Enter') cmConfirmRename()" />
        <button class="btn-profile-action btn-rename" onclick="cmConfirmRename()">Save</button>
        <button class="btn-profile-action" onclick="closeCopyMovePanel()">Cancel</button>
      </div>
      ${err}
    </div>`;
  }

  return '';
}

function confirmDeleteProfile(id) {
  if (deleteBmpConfirmId === id) {
    deleteBmpConfirmId = null;
    deleteProfile(id);
  } else {
    deleteBmpConfirmId = id;
    renderProfileModal();
    setTimeout(() => {
      if (deleteBmpConfirmId === id) { deleteBmpConfirmId = null; renderProfileModal(); }
    }, 3000);
  }
}

function renderProfileModal() {
  const folderEl = document.getElementById('profile-folder-info');
  const kind = getActiveBackendKind();
  if (folderEl) {
    if (kind === 'drive') {
      const em = driveUserEmail();
      folderEl.textContent = em ? `Google Drive (${em})` : 'Google Drive';
    } else {
      folderEl.textContent = getFolderName() || '(none)';
    }
  }
  const copyBtn = document.getElementById('btn-copy-to-drive');
  if (copyBtn) copyBtn.style.display = kind === 'local' ? '' : 'none';
  const copyStatus = document.getElementById('copy-to-drive-status');
  if (copyStatus) copyStatus.textContent = '';

  // Populate ChromeProfile selector
  const cpSelect = document.getElementById('cp-select');
  if (cpSelect) {
    cpSelect.innerHTML = chromeProfiles.map(cp =>
      `<option value="${cp.id}"${cp.id === activeChromeProfileId ? ' selected' : ''}>${esc(cp.name)}</option>`
    ).join('');
  }

  // Show BMPs for the active ChromeProfile only
  const cp = chromeProfiles.find(c => c.id === activeChromeProfileId);
  const bmpList = document.getElementById('profile-list');
  if (!cp) { bmpList.innerHTML = ''; return; }

  const rows = cp.profiles.length === 0
    ? '<p class="bmp-empty">No bookmark profiles yet.</p>'
    : cp.profiles.map(bmp => {
        if (bmp.isDefault) {
          return `
          <div class="profile-row bmp-row bmp-row-default" id="prow-${bmp.id}" title="The Default profile can't be renamed or deleted">
            <input class="profile-name-input" value="${esc(bmp.name)}" disabled />
            <span class="bmp-default-badge">Locked</span>
            <button class="btn-profile-action" onclick="openCopyMovePanel('${bmp.id}', 'copy')">Copy \u25be</button>
          </div>
          ${_cmPanelHTML(bmp)}`;
        }
        const isConfirm = deleteBmpConfirmId === bmp.id;
        return `
          <div class="profile-row bmp-row" id="prow-${bmp.id}">
            <input class="profile-name-input" value="${esc(bmp.name)}" id="pinput-${bmp.id}"
                   onkeydown="if(event.key==='Enter') renameProfile('${bmp.id}', this.value)" />
            <button class="btn-profile-action btn-rename"
                    onclick="renameProfile('${bmp.id}', document.getElementById('pinput-${bmp.id}').value)">Rename</button>
            <button class="btn-profile-action btn-delete${isConfirm ? ' btn-danger' : ''}"
                    onclick="confirmDeleteProfile('${bmp.id}')">
              ${isConfirm ? 'Confirm?' : 'Delete'}
            </button>
            <button class="btn-profile-action" onclick="openCopyMovePanel('${bmp.id}', 'copy')">Copy \u25be</button>
            <button class="btn-profile-action" onclick="openCopyMovePanel('${bmp.id}', 'move')">Move \u25be</button>
          </div>
          ${_cmPanelHTML(bmp)}`;
      }).join('');

  bmpList.innerHTML = rows + `
    <div class="bmp-add-row">
      <input class="profile-name-input" id="new-bmp-${cp.id}" placeholder="New profile name…"
             onkeydown="if(event.key==='Enter'){ handleAddBmp('${cp.id}', this); }" />
      <button class="btn-profile-action"
              onclick="handleAddBmp('${cp.id}', document.getElementById('new-bmp-${cp.id}'))">+ Add</button>
      <span class="import-status" id="err-bmp-${cp.id}"></span>
    </div>`;
}

function handleAddBmp(chromeProfileId, inputEl) {
  const name = inputEl.value.trim();
  const errEl = document.getElementById('err-bmp-' + chromeProfileId);
  if (!name) { if (errEl) errEl.textContent = 'Name is required.'; return; }
  if (errEl) errEl.textContent = '';
  inputEl.value = '';
  createProfile(name, chromeProfileId);
}

// ── Header display ────────────────────────────────────────────────────────
function updateProfileDisplay() {
  const bmp = profiles.find(p => p.id === activeProfileId);
  const btn = document.getElementById('btn-profile-name');
  if (!btn) return;
  btn.textContent = bmp ? `${bmp.name} \u25be` : `Profile \u25be`;
}
