// Category management — CRUD + ordering.
// Depends on: state.js (bookmarks, customCategories, categoryOrder, activeCategory,
//                        editCategoriesMode, draggedCategory)
//             storage.js (saveBookmarks, saveCustomCategories, saveCategoryOrder)
//             render.js (renderCategoryPills, renderBookmarks, getCategories, getOrderedRealCats)

function toggleEditCategoriesMode() {
  editCategoriesMode = !editCategoriesMode;
  renderCategoryPills();
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

// Rename a category across all bookmarks and in customCategories.
// If newName already exists the bookmarks are merged into that category.
function renameCategory(oldName, newName) {
  newName = newName.trim();
  if (!newName || newName === oldName) return;

  bookmarks.forEach(b => { if (b.category === oldName) b.category = newName; });
  saveBookmarks();

  customCategories = customCategories.filter(c => c !== oldName).filter(c => c !== newName);
  saveCustomCategories();

  // Keep position in order: replace old name; if merging into existing, just remove old.
  if (categoryOrder.includes(newName)) {
    categoryOrder = categoryOrder.filter(c => c !== oldName);
  } else {
    categoryOrder = categoryOrder.map(c => c === oldName ? newName : c);
  }
  saveCategoryOrder();

  if (activeCategory === oldName) { setCategory(newName); return; }
  renderCategoryPills();
  renderBookmarks();
}

// Delete a category: all its bookmarks become uncategorised (category = '').
function deleteCategory(catName) {
  bookmarks.forEach(b => { if (b.category === catName) b.category = ''; });
  saveBookmarks();

  customCategories = customCategories.filter(c => c !== catName);
  saveCustomCategories();

  categoryOrder = categoryOrder.filter(c => c !== catName);
  saveCategoryOrder();

  if (activeCategory === catName) { setCategory('All'); return; }
  renderCategoryPills();
  renderBookmarks();
}

// Add a new empty category (visible in pills and modal dropdown before any bookmark uses it).
function addCategory(name) {
  name = name.trim();
  if (!name) return;
  if (getCategories().includes(name)) return;   // already exists — skip silently

  customCategories.push(name);
  customCategories.sort();
  saveCustomCategories();
  // Leave categoryOrder unchanged — new cat will appear alphabetically at the end
  // until the user explicitly drags it into position.
  renderCategoryPills();
}

// ── Ordering ─────────────────────────────────────────────────────────────────

// Insert draggedCat immediately before targetCat in the display order.
function reorderCategory(draggedCat, targetCat) {
  let current = getOrderedRealCats();
  current = current.filter(c => c !== draggedCat);
  const idx = current.indexOf(targetCat);
  if (idx === -1) {
    current.push(draggedCat);
  } else {
    current.splice(idx, 0, draggedCat);
  }
  categoryOrder = current;
  saveCategoryOrder();
  renderCategoryPills();
}

// ── Pill drag (normal mode) ───────────────────────────────────────────────────

function catPillDragStart(e, cat) {
  draggedCategory = cat;
  e.dataTransfer.effectAllowed = 'move';
  requestAnimationFrame(() => { e.target.classList.add('dragging-pill'); });
}

function catPillDragEnd() {
  document.querySelectorAll('.pill.dragging-pill').forEach(p => p.classList.remove('dragging-pill'));
  draggedCategory = null;
}

// ── Row drag (edit mode) ──────────────────────────────────────────────────────

function catRowDragStart(e, cat) {
  draggedCategory = cat;
  e.dataTransfer.effectAllowed = 'move';
  requestAnimationFrame(() => { e.currentTarget.classList.add('dragging-row'); });
}

function catRowDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('row-drag-over');
}

function catRowDragLeave(e) {
  e.currentTarget.classList.remove('row-drag-over');
}

function catRowDrop(e, targetCat) {
  e.preventDefault();
  e.currentTarget.classList.remove('row-drag-over');
  if (!draggedCategory || draggedCategory === targetCat) return;
  reorderCategory(draggedCategory, targetCat);
  draggedCategory = null;
}

function catRowDragEnd() {
  document.querySelectorAll('.cat-edit-row.dragging-row').forEach(r => r.classList.remove('dragging-row'));
  document.querySelectorAll('.cat-edit-row.row-drag-over').forEach(r => r.classList.remove('row-drag-over'));
  draggedCategory = null;
}

// ── Import categories (+ bookmarks) from another BMP ──────────────────────
function openImportPanel() {
  const other = profiles.filter(p => p.id !== activeProfileId);
  importState = {
    sourceBmpId: other[0]?.id || '',
    selected: new Set(),
  };
  if (importState.sourceBmpId) _seedImportSelection();
  renderCategoryPills();
}

function _seedImportSelection() {
  const src = profiles.find(p => p.id === importState.sourceBmpId);
  if (!src) return;
  const cats = new Set([
    ...(src.bookmarks || []).map(b => b.category).filter(c => c !== ''),
    ...(src.customCategories || []),
  ]);
  importState.selected = cats;
}

function selectImportSource(bmpId) {
  if (!importState) return;
  importState.sourceBmpId = bmpId;
  _seedImportSelection();
  renderCategoryPills();
}

function toggleImportCat(cat) {
  if (!importState) return;
  if (importState.selected.has(cat)) importState.selected.delete(cat);
  else importState.selected.add(cat);
  renderCategoryPills();
}

function cancelImport() { importState = null; renderCategoryPills(); }

function doImport() {
  if (!importState) return;
  const src = profiles.find(p => p.id === importState.sourceBmpId);
  if (!src) { importState = null; renderCategoryPills(); return; }

  const picked = importState.selected;
  if (picked.size === 0) { cancelImport(); return; }

  // Merge category names (skip ones that already exist in the target).
  const knownCats = new Set([
    ...bookmarks.map(b => b.category).filter(c => c !== ''),
    ...customCategories,
  ]);
  for (const cat of picked) {
    if (!knownCats.has(cat) && !customCategories.includes(cat)) customCategories.push(cat);
    if (!categoryOrder.includes(cat)) categoryOrder.push(cat);
  }
  saveCustomCategories();
  saveCategoryOrder();

  // Merge bookmarks — dedupe by URL against the current target.
  const existingUrls = new Set(bookmarks.map(b => b.url));
  for (const b of (src.bookmarks || [])) {
    if (!picked.has(b.category)) continue;
    if (existingUrls.has(b.url)) continue;
    bookmarks.unshift({
      ...b,
      id: uid(),
      favourite: b.favourite === true,
    });
    existingUrls.add(b.url);
  }
  saveBookmarks();

  importState = null;
  renderCategoryPills();
  renderBookmarks();
}

// ── Promote a category to its own BMP (MOVE) ──────────────────────────────
function openPromotePanel(categoryName) {
  if (promoteState && promoteState.categoryName === categoryName) {
    promoteState = null;
  } else {
    promoteState = {
      categoryName,
      phase: 'pick',
      nameValue: categoryName,
      targetIsDefault: false,
      error: '',
    };
  }
  renderCategoryPills();
  if (promoteState) {
    const inp = document.getElementById('promote-name-input');
    if (inp) { inp.focus(); inp.select(); }
  }
}

function cancelPromote() { promoteState = null; renderCategoryPills(); }

function _attemptPromote(name, mode) {
  const cp = chromeProfiles.find(c => c.id === activeChromeProfileId);
  if (!cp) return { status: 'error', error: 'No active Chrome profile.' };
  const existing = cp.profiles.find(p => p.name === name);

  if (existing && mode !== 'overwrite') {
    return { status: 'collision', targetIsDefault: existing.isDefault === true };
  }

  // Bookmarks to move: those assigned to this category in the active BMP.
  const moved = bookmarks.filter(b => b.category === promoteState.categoryName);
  if (moved.length === 0) return { status: 'error', error: 'Category has no bookmarks.' };

  const newBookmarks = moved.map(b => ({ ...b, id: uid(), category: promoteState.categoryName }));

  const bmpData = {
    bookmarks:        newBookmarks,
    customCategories: [promoteState.categoryName],
    categoryOrder:    [promoteState.categoryName],
    lastCategory:     promoteState.categoryName,
  };

  if (existing && mode === 'overwrite') {
    existing.bookmarks        = bmpData.bookmarks;
    existing.customCategories = bmpData.customCategories;
    existing.categoryOrder    = bmpData.categoryOrder;
    existing.lastCategory     = bmpData.lastCategory;
  } else {
    const defaultIdx = cp.profiles.findIndex(p => p.isDefault);
    const newBmp = { id: uid(), name, ...bmpData };
    if (defaultIdx === -1) cp.profiles.push(newBmp);
    else cp.profiles.splice(defaultIdx, 0, newBmp);
  }

  // Remove the promoted bookmarks + category from the source (active) BMP.
  bookmarks        = bookmarks.filter(b => b.category !== promoteState.categoryName);
  customCategories = customCategories.filter(c => c !== promoteState.categoryName);
  categoryOrder    = categoryOrder.filter(c => c !== promoteState.categoryName);
  if (activeCategory === promoteState.categoryName) activeCategory = 'All';

  profiles = chromeProfiles.flatMap(c => c.profiles);
  _saveActiveProfile();
  _writeChromeProfileFile(cp).catch(console.error);

  return { status: 'done' };
}

function confirmPromote() {
  if (!promoteState) return;
  const inp = document.getElementById('promote-name-input');
  const name = (inp?.value || promoteState.nameValue || '').trim();
  if (!name) { promoteState.error = 'Name is required.'; renderCategoryPills(); return; }
  promoteState.nameValue = name;

  const result = _attemptPromote(name, null);
  _handlePromoteResult(result);
}

function promoteOverwrite() {
  if (!promoteState) return;
  const result = _attemptPromote(promoteState.nameValue, 'overwrite');
  _handlePromoteResult(result);
}

function _handlePromoteResult(result) {
  if (result.status === 'done') {
    promoteState = null;
    renderCategoryPills();
    renderBookmarks();
    if (typeof renderProfileModal === 'function') renderProfileModal();
    return;
  }
  if (result.status === 'collision') {
    promoteState.phase = 'collision';
    promoteState.targetIsDefault = result.targetIsDefault === true;
    promoteState.error = '';
    renderCategoryPills();
    return;
  }
  promoteState.error = result.error || 'Something went wrong.';
  renderCategoryPills();
}
