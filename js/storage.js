// Depends on: filestore.js (readProfileFile, writeProfileFile, deleteProfileFile,
//               renameProfileFile, listProfileFiles, readOrderFile, writeOrderFile),
//             state.js (SAMPLES, bookmarks, customCategories, categoryOrder,
//                       chromeProfiles, activeChromeProfileId, profiles, activeProfileId),
//             utils.js (uid)

const ACTIVE_PROFILE_KEY = 'bm_active_profile_v1';
const ACTIVE_CP_KEY      = 'bm_active_chrome_profile_v1';

// ── Internal helpers ──────────────────────────────────────────────────────

// Serialise a ChromeProfile (with all its BMPs) to {cp.name}.json.
function _writeChromeProfileFile(cp) {
  return writeProfileFile(cp.name, {
    id:         cp.id,
    folderName: cp.folderName,
    email:      cp.email,
    profiles:   cp.profiles.map(bmp => ({
      id:               bmp.id,
      name:             bmp.name,
      bookmarks:        bmp.bookmarks,
      customCategories: bmp.customCategories,
      categoryOrder:    bmp.categoryOrder,
      lastCategory:     bmp.lastCategory || 'All',
      ...(bmp.isDefault ? { isDefault: true } : {}),
    })),
  });
}

// Write the active ChromeProfile (all its BMPs) back to disk.
function _saveActiveProfile() {
  const cp = chromeProfiles.find(cp => cp.id === activeChromeProfileId);
  if (!cp) return;
  _writeChromeProfileFile(cp).catch(e => console.error('bookmarks: save failed', e));
}

// Kept for call-site symmetry.
function _saveProfiles() { _saveActiveProfile(); }

function _saveActiveProfileId() {
  if (activeProfileId) localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
}

function _saveActiveChromeProfileId() {
  if (activeChromeProfileId) localStorage.setItem(ACTIVE_CP_KEY, activeChromeProfileId);
}

// Hydrate bookmarks/customCategories/categoryOrder from the active BMP.
function _hydrateFromActiveProfile() {
  if (!activeProfileId) {
    bookmarks = []; customCategories = []; categoryOrder = []; activeCategory = 'All';
    return;
  }
  const p = profiles.find(p => p.id === activeProfileId);
  if (!p) { bookmarks = []; customCategories = []; categoryOrder = []; activeCategory = 'All'; return; }
  bookmarks        = (p.bookmarks || []).map(b => ({ favourite: false, ...b }));
  customCategories = p.customCategories || [];
  categoryOrder    = p.categoryOrder    || [];
  activeCategory   = p.lastCategory     || 'All';
  p.bookmarks = bookmarks;
}

// ── Main async load entry point ───────────────────────────────────────────
async function loadProfiles() {
  const SEEDS = [
    { name: 'My Profile', folderName: 'Default', email: '' },
  ];

  const names = await listProfileFiles();
  chromeProfiles = [];

  // Fetch all profile files in parallel — on Drive this cuts load time roughly Nx.
  const results = await Promise.all(names.map(n => readProfileFile(n).then(d => [n, d])));

  for (const [name, data] of results) {
    if (!data) continue;

    // Old format (no 'profiles' array at root) → discard and delete file.
    if (!Array.isArray(data.profiles)) {
      await deleteProfileFile(name);
      continue;
    }

    const cpId = data.id || uid();
    chromeProfiles.push({
      id:         cpId,
      name,
      folderName: data.folderName || '',
      email:      data.email      || '',
      profiles:   (data.profiles || []).map(bmp => ({
        id:               bmp.id || uid(),
        name:             bmp.name,
        bookmarks:        (bmp.bookmarks || []).map(b => ({ favourite: false, ...b })),
        customCategories: bmp.customCategories || [],
        categoryOrder:    bmp.categoryOrder    || [],
        lastCategory:     bmp.lastCategory     || 'All',
        isDefault:        bmp.isDefault === true,
      })),
    });
  }

  // Seed initial ChromeProfiles on first run.
  if (!chromeProfiles.length) {
    for (const s of SEEDS) {
      const cp = { id: uid(), ...s, profiles: [] };
      chromeProfiles.push(cp);
      await _writeChromeProfileFile(cp);
    }
  }

  // Apply _order.json for ChromeProfile display order.
  const savedOrder = await readOrderFile();
  if (savedOrder && Array.isArray(savedOrder)) {
    const ordered = savedOrder.map(n => chromeProfiles.find(cp => cp.name === n)).filter(Boolean);
    const tail    = chromeProfiles.filter(cp => !savedOrder.includes(cp.name));
    chromeProfiles = [...ordered, ...tail];
  }

  // Ensure every ChromeProfile ends with a locked 'Default' BMP.
  for (const cp of chromeProfiles) {
    const existing = cp.profiles.filter(p => p.isDefault);
    const others   = cp.profiles.filter(p => !p.isDefault);
    if (existing.length === 0) {
      cp.profiles = [...others, {
        id: uid(), name: 'Default', isDefault: true,
        bookmarks: [], customCategories: [], categoryOrder: [],
      }];
      await _writeChromeProfileFile(cp);
    } else {
      cp.profiles = [...others, ...existing];
    }
  }

  // Rebuild flat BMP list — objects are shared references into chromeProfiles[x].profiles.
  profiles = chromeProfiles.flatMap(cp => cp.profiles);

  // Restore active ChromeProfile.
  const savedCpId = localStorage.getItem(ACTIVE_CP_KEY);
  activeChromeProfileId = (savedCpId && chromeProfiles.find(cp => cp.id === savedCpId))
    ? savedCpId
    : (chromeProfiles[0]?.id || null);

  // Restore active BMP within that ChromeProfile.
  const activeCp = chromeProfiles.find(cp => cp.id === activeChromeProfileId);
  if (activeCp && activeCp.profiles.length) {
    const savedBmpId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    activeProfileId = (savedBmpId && activeCp.profiles.find(p => p.id === savedBmpId))
      ? savedBmpId
      : activeCp.profiles[0].id;
  } else {
    activeProfileId = null;
  }

  _hydrateFromActiveProfile();
}

// ── Save functions ────────────────────────────────────────────────────────
function saveBookmarks() {
  const p = profiles.find(p => p.id === activeProfileId);
  if (p) p.bookmarks = bookmarks;
  _saveActiveProfile();
}

function saveCustomCategories() {
  const p = profiles.find(p => p.id === activeProfileId);
  if (p) p.customCategories = customCategories;
  _saveActiveProfile();
}

function saveCategoryOrder() {
  const p = profiles.find(p => p.id === activeProfileId);
  if (p) p.categoryOrder = categoryOrder;
  _saveActiveProfile();
}
