// Depends on: state.js (bookmarks, catMode, editingId)
//             storage.js (saveBookmarks)
//             render.js (renderCategoryPills, renderBookmarks)
//             utils.js (esc, uid)

async function openModal() {
  editingId = null;
  resetForm();
  document.getElementById('modal-title').textContent = 'Add Bookmark';
  document.getElementById('btn-submit').textContent = 'Save Bookmark';
  populateCatSelect();
  document.getElementById('overlay').classList.add('open');

  // Pre-fill URL from clipboard if it contains a valid link.
  try {
    const text = await navigator.clipboard.readText();
    const trimmed = text.trim();
    let candidate = trimmed;
    if (candidate && !/^https?:\/\//i.test(candidate)) candidate = 'https://' + candidate;
    new URL(candidate); // throws if invalid
    document.getElementById('f-url').value = trimmed;
    document.getElementById('f-title').focus();
  } catch {
    document.getElementById('f-title').focus();
  }
}

function openEditModal(id) {
  const b = bookmarks.find(bm => bm.id === id);
  if (!b) return;
  editingId = id;
  resetForm();
  document.getElementById('modal-title').textContent = 'Edit Bookmark';
  document.getElementById('btn-submit').textContent = 'Update Bookmark';
  populateCatSelect();

  document.getElementById('f-title').value = b.title;
  document.getElementById('f-url').value = b.url;
  document.getElementById('f-notes').value = b.notes;

  // Use the dropdown if the category already exists, otherwise switch to text input.
  const sel = document.getElementById('f-cat-select');
  const existingOptions = [...sel.options].map(o => o.value);
  if (existingOptions.includes(b.category)) {
    sel.value = b.category;
  } else {
    catMode = 'input';
    document.getElementById('cat-select-row').style.display = 'none';
    document.getElementById('cat-input-row').style.display = '';
    document.getElementById('cat-mode-toggle').textContent = '(pick existing)';
    document.getElementById('f-cat-input').value = b.category;
  }

  document.getElementById('overlay').classList.add('open');
  document.getElementById('f-title').focus();
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  editingId = null;
}

function overlayClick(e) {
  if (e.target === document.getElementById('overlay')) closeModal();
}

function resetForm() {
  document.getElementById('bookmark-form').reset();
  ['err-title', 'err-url', 'err-cat'].forEach(id => document.getElementById(id).classList.remove('show'));
  catMode = 'select';
  document.getElementById('cat-select-row').style.display = '';
  document.getElementById('cat-input-row').style.display = 'none';
  document.getElementById('cat-mode-toggle').textContent = '(or type a new one)';
}

function toggleCatMode() {
  if (catMode === 'select') {
    catMode = 'input';
    document.getElementById('cat-select-row').style.display = 'none';
    document.getElementById('cat-input-row').style.display = '';
    document.getElementById('cat-mode-toggle').textContent = '(pick existing)';
    document.getElementById('f-cat-input').focus();
  } else {
    catMode = 'select';
    document.getElementById('cat-select-row').style.display = '';
    document.getElementById('cat-input-row').style.display = 'none';
    document.getElementById('cat-mode-toggle').textContent = '(or type a new one)';
  }
}

function populateCatSelect() {
  const sel = document.getElementById('f-cat-select');
  // Include custom (empty) categories so they appear in the dropdown immediately after creation.
  const cats = [...new Set([
    ...bookmarks.map(b => b.category).filter(c => c !== ''),
    ...customCategories,
  ])].sort();
  sel.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (cats.length === 0) {
    catMode = 'input';
    document.getElementById('cat-select-row').style.display = 'none';
    document.getElementById('cat-input-row').style.display = '';
  }
}

function handleSubmit(e) {
  e.preventDefault();
  let valid = true;

  const title  = document.getElementById('f-title').value.trim();
  const rawUrl = document.getElementById('f-url').value.trim();
  const notes  = document.getElementById('f-notes').value.trim();

  // Validate title.
  if (!title) {
    document.getElementById('err-title').classList.add('show');
    valid = false;
  } else {
    document.getElementById('err-title').classList.remove('show');
  }

  // Validate & normalise URL — prepend https:// when protocol is absent.
  let url = rawUrl;
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  let urlOk = false;
  try { new URL(url); urlOk = true; } catch {}
  if (!url || !urlOk) {
    document.getElementById('err-url').classList.add('show');
    valid = false;
  } else {
    document.getElementById('err-url').classList.remove('show');
  }

  // Validate category.
  let category = catMode === 'select'
    ? document.getElementById('f-cat-select').value.trim()
    : document.getElementById('f-cat-input').value.trim();
  if (!category) {
    document.getElementById('err-cat').classList.add('show');
    valid = false;
  } else {
    document.getElementById('err-cat').classList.remove('show');
  }

  if (!valid) return;

  if (editingId) {
    const idx = bookmarks.findIndex(b => b.id === editingId);
    if (idx !== -1) {
      bookmarks[idx] = { ...bookmarks[idx], title, url, category, notes };
    }
    editingId = null;
  } else {
    bookmarks.unshift({ id: uid(), title, url, category, notes, favourite: false, createdAt: new Date().toISOString() });
  }

  saveBookmarks();
  closeModal();
  renderCategoryPills();
  renderBookmarks();
}
