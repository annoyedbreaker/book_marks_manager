// Depends on: state.js (bookmarks, activeCategory, deleteConfirmId, editCategoriesMode,
//                        customCategories, categoryOrder, draggedCategory)
//             utils.js (esc)

// Returns all real category names in user-defined order, with unordered ones alphabetically appended.
function getOrderedRealCats() {
  const allReal = [...new Set([
    ...bookmarks.map(b => b.category).filter(c => c !== ''),
    ...customCategories,
  ])];
  const ordered   = categoryOrder.filter(c => allReal.includes(c));
  const unordered = allReal.filter(c => !categoryOrder.includes(c)).sort();
  return [...ordered, ...unordered];
}

function getCategories() {
  const realCats = getOrderedRealCats();
  const hasUncategorised = bookmarks.some(b => b.category === '');
  return ['All', 'Favourites', ...realCats, ...(hasUncategorised ? ['Not Assigned'] : [])];
}

function _importSectionHTML() {
  const others = profiles.filter(p => p.id !== activeProfileId);
  if (others.length === 0) return '';

  if (!importState) {
    return `
      <div class="cat-import-bar">
        <button class="btn-cat-action btn-cat-import" onclick="openImportPanel()">
          ⇩ Import categories from another profile…
        </button>
      </div>`;
  }

  const src = profiles.find(p => p.id === importState.sourceBmpId);
  const srcCats = src
    ? [...new Set([
        ...(src.bookmarks || []).map(b => b.category).filter(c => c !== ''),
        ...(src.customCategories || []),
      ])].sort()
    : [];

  const options = others.map(p =>
    `<option value="${esc(p.id)}" ${p.id === importState.sourceBmpId ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');

  return `
    <div class="cat-import-panel">
      <div class="cat-import-header">
        <span class="cat-import-title">Import from:</span>
        <select class="cat-import-select" onchange="selectImportSource(this.value)">${options}</select>
        <button class="btn-cat-action btn-cat-cancel" onclick="cancelImport()">Cancel</button>
        <button class="btn-cat-action btn-cat-add" onclick="doImport()">Import Selected</button>
      </div>
      ${srcCats.length === 0
        ? '<p class="cat-edit-empty">That profile has no categories.</p>'
        : `<div class="cat-import-list">${srcCats.map(c => {
            const esq = c.replace(/'/g,"\\'");
            const checked = importState.selected.has(c) ? 'checked' : '';
            return `<label class="cat-import-item">
              <input type="checkbox" ${checked} onchange="toggleImportCat('${esq}')" />
              <span>${esc(c)}</span>
            </label>`;
          }).join('')}</div>`
      }
    </div>`;
}

function _promotePanelHTML(cat) {
  if (!promoteState || promoteState.categoryName !== cat) return '';

  const err = promoteState.error
    ? `<div class="cat-promote-error">${esc(promoteState.error)}</div>`
    : '';

  if (promoteState.phase === 'collision') {
    return `
      <div class="cat-promote-panel">
        <div class="cat-promote-msg">
          A profile named "${esc(promoteState.nameValue)}" already exists in this Chrome profile.
          ${promoteState.targetIsDefault ? 'It is the locked Default — only Overwrite is available.' : ''}
        </div>
        <div class="cat-promote-row">
          <button class="btn-cat-action btn-cat-del" onclick="promoteOverwrite()">Overwrite</button>
          ${promoteState.targetIsDefault ? '' : `
            <input class="cat-edit-input" id="promote-name-input" value="${esc(promoteState.nameValue)}" placeholder="New name…" />
            <button class="btn-cat-action btn-cat-rename" onclick="confirmPromote()">Save As New Name</button>
          `}
          <button class="btn-cat-action btn-cat-cancel" onclick="cancelPromote()">Cancel</button>
        </div>
        ${err}
      </div>`;
  }

  return `
    <div class="cat-promote-panel">
      <div class="cat-promote-msg">Promote "${esc(cat)}" to its own profile (bookmarks will move):</div>
      <div class="cat-promote-row">
        <input class="cat-edit-input" id="promote-name-input" value="${esc(promoteState.nameValue)}"
          onkeydown="if(event.key==='Enter') confirmPromote()" placeholder="Profile name…" />
        <button class="btn-cat-action btn-cat-add" onclick="confirmPromote()">Save</button>
        <button class="btn-cat-action btn-cat-cancel" onclick="cancelPromote()">Cancel</button>
      </div>
      ${err}
    </div>`;
}

function renderCategoryPills() {
  const container = document.getElementById('pills');

  if (editCategoriesMode) {
    const allCats = getOrderedRealCats();

    container.innerHTML = `
      <div class="cat-edit-panel">
        <div class="cat-edit-header">
          <span class="cat-edit-title">Edit Categories</span>
          <button class="btn-cat-done" onclick="toggleEditCategoriesMode()">✓ Done</button>
        </div>
        ${_importSectionHTML()}
        <div class="cat-edit-rows">
          ${allCats.length === 0
            ? '<p class="cat-edit-empty">No categories yet. Add one below.</p>'
            : allCats.map((c, i) => {
                const esq = c.replace(/'/g,"\\'");
                return `
              <div class="cat-edit-row" draggable="true"
                ondragstart="catRowDragStart(event, '${esq}') "
                ondragover="catRowDragOver(event)"
                ondragleave="catRowDragLeave(event)"
                ondrop="catRowDrop(event, '${esq}') "
                ondragend="catRowDragEnd()">
                <span class="drag-handle" title="Drag to reorder">⠿</span>
                <input class="cat-edit-input" value="${esc(c)}" id="cei-${i}"
                  onkeydown="if(event.key==='Enter') renameCategory('${esq}', this.value)" />
                <button class="btn-cat-action btn-cat-rename"
                  onclick="renameCategory('${esq}', document.getElementById('cei-${i}').value)">Rename</button>
                <button class="btn-cat-action btn-cat-promote"
                  onclick="openPromotePanel('${esq}')" title="Promote to its own profile">↗ Promote</button>
                <button class="btn-cat-action btn-cat-del"
                  onclick="deleteCategory('${esq}')">Delete</button>
              </div>
              ${_promotePanelHTML(c)}`;
              }).join('')
          }
          <div class="cat-edit-row cat-add-row">
            <input class="cat-edit-input" id="cat-new-inp" placeholder="New category name…"
              onkeydown="if(event.key==='Enter'){ addCategory(this.value); this.value=''; }" />
            <button class="btn-cat-action btn-cat-add"
              onclick="addCategory(document.getElementById('cat-new-inp').value); document.getElementById('cat-new-inp').value=''">+ Add</button>
          </div>
        </div>
      </div>`;
    return;
  }

  // Normal mode: filter pills (with reorder drag) + edit button
  const cats = getCategories();
  container.innerHTML = cats.map(c => {
    const isFav        = c === 'Favourites';
    const isUnassigned = c === 'Not Assigned';
    const isActive     = c === activeCategory;
    const isRealCat    = !isFav && !isUnassigned && c !== 'All';

    // Real category pills: accept both bookmark drops AND pill-reorder drops;
    // are also themselves draggable for reordering.
    const dropAttrs = isRealCat
      ? `ondragover="dragOverPill(event)" ondragleave="dragLeavePill(event)" ondrop="dropOnPill(event, '${c.replace(/'/g,"\\'")}')"`
      : '';
    const pilDragAttrs = isRealCat
      ? `draggable="true" ondragstart="catPillDragStart(event, '${c.replace(/'/g,"\\'")}') " ondragend="catPillDragEnd()"`
      : '';

    const extraClass = isFav ? 'pill-fav' : isUnassigned ? 'pill-unassigned' : '';
    return `<button class="pill ${extraClass} ${isActive ? 'active' : ''}"
      onclick="setCategory('${c.replace(/'/g,"\\'")}') "
      ${pilDragAttrs}
      ${dropAttrs}>
      ${isFav ? '★ ' : ''}${esc(c)}
    </button>`;
  }).join('')
    + `<button class="btn-edit-cats" onclick="toggleEditCategoriesMode()" title="Manage categories">✎ Edit</button>`;
}

function setCategory(cat) {
  activeCategory = cat;
  const p = profiles.find(p => p.id === activeProfileId);
  if (p) { p.lastCategory = cat; _saveActiveProfile(); }
  renderCategoryPills();
  renderBookmarks();
}

function renderBookmarks() {
  const query = document.getElementById('search').value.trim().toLowerCase();
  const grid  = document.getElementById('grid');
  const count = document.getElementById('count');

  let filtered = bookmarks;
  if (activeCategory === 'Favourites') {
    filtered = filtered.filter(b => b.favourite);
  } else if (activeCategory === 'Not Assigned') {
    filtered = filtered.filter(b => b.category === '');
  } else if (activeCategory !== 'All') {
    filtered = filtered.filter(b => b.category === activeCategory);
  }
  if (query) {
    filtered = filtered.filter(b =>
      b.title.toLowerCase().includes(query) ||
      b.category.toLowerCase().includes(query)
    );
  }

  count.textContent = `${filtered.length} bookmark${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon">${activeCategory === 'Favourites' ? '★' : '🔖'}</div>
        <h3>No bookmarks found</h3>
        <p>${
          activeCategory === 'Favourites'
            ? 'Star a bookmark to add it to your favourites.'
            : activeCategory === 'Not Assigned'
              ? 'All bookmarks have a category assigned.'
              : query || activeCategory !== 'All'
                ? 'Try a different search or category.'
                : 'Click "Add Bookmark" to get started.'
        }</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(b => cardHTML(b)).join('');
}

function cardHTML(b) {
  let host = '';
  try { host = new URL(b.url).hostname; } catch {}
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  const date = new Date(b.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const isConfirm  = deleteConfirmId === b.id;
  const catLabel   = b.category || 'Not Assigned';
  const badgeClass = b.category ? '' : 'badge-unassigned';

  return `
    <div class="card ${b.favourite ? 'is-fav' : ''}" id="card-${b.id}"
      draggable="true"
      ondragstart="dragStart(event, '${b.id}')"
      ondragend="dragEnd()"
      ondragover="dragOverCard(event, '${b.id}')"
      ondragleave="dragLeaveCard(event)"
      ondrop="dropOnCard(event, '${b.id}')">
      <div class="card-top">
        <img class="favicon" src="${faviconUrl}" alt="" onerror="this.style.opacity='.2'" loading="lazy" />
        <div class="card-info">
          <a class="card-title" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer" title="${esc(b.title)}">${esc(b.title)}</a>
          <div class="card-url">${esc(host || b.url)}</div>
        </div>
        <button class="btn-star ${b.favourite ? 'active' : ''}"
          onclick="toggleFavourite('${b.id}')"
          title="${b.favourite ? 'Remove from favourites' : 'Add to favourites'}"
          aria-label="${b.favourite ? 'Remove from favourites' : 'Add to favourites'}">★</button>
      </div>
      <span class="card-badge ${badgeClass}">${esc(catLabel)}</span>
      ${b.notes ? `<p class="card-notes">${esc(b.notes)}</p>` : ''}
      <div class="card-footer">
        <span class="card-date">${date}</span>
        <div class="card-actions">
          <button class="btn-edit" onclick="openEditModal('${b.id}')">Edit</button>
          <button class="btn-delete ${isConfirm ? 'confirm' : ''}"
            onclick="handleDelete('${b.id}')"
            title="${isConfirm ? 'Click again to confirm' : 'Delete bookmark'}">
            ${isConfirm ? 'Confirm?' : 'Delete'}
          </button>
        </div>
      </div>
    </div>`;
}
