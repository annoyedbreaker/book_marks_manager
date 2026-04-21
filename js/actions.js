// Depends on: state.js (bookmarks, activeCategory, deleteConfirmId, draggedId)
//             storage.js (saveBookmarks)
//             render.js (renderBookmarks, renderCategoryPills, getCategories)

// ── Favourites ───────────────────────────────────────────────────────────
function toggleFavourite(id) {
  const b = bookmarks.find(bm => bm.id === id);
  if (!b) return;
  b.favourite = !b.favourite;
  saveBookmarks();
  renderBookmarks();
}

// ── Delete ───────────────────────────────────────────────────────────────
function handleDelete(id) {
  if (deleteConfirmId === id) {
    bookmarks = bookmarks.filter(b => b.id !== id);
    saveBookmarks();
    deleteConfirmId = null;
    const cats = getCategories();
    if (!cats.includes(activeCategory)) { setCategory('All'); return; }
    renderCategoryPills();
    renderBookmarks();
  } else {
    deleteConfirmId = id;
    renderBookmarks();
    // Auto-reset confirmation after 3 s if not acted upon.
    setTimeout(() => {
      if (deleteConfirmId === id) { deleteConfirmId = null; renderBookmarks(); }
    }, 3000);
  }
}

// ── Drag-and-drop ────────────────────────────────────────────────────────
function dragStart(e, id) {
  draggedId = id;
  e.dataTransfer.setData('text/plain', id);
  e.dataTransfer.effectAllowed = 'move';
  // Delay so the drag ghost captures the original card before it fades.
  requestAnimationFrame(() => {
    const el = document.getElementById('card-' + id);
    if (el) el.classList.add('dragging');
  });
  document.getElementById('pills').classList.add('drag-active');
}

function dragEnd() {
  if (draggedId) {
    const el = document.getElementById('card-' + draggedId);
    if (el) el.classList.remove('dragging');
  }
  draggedId = null;
  document.getElementById('pills').classList.remove('drag-active');
  document.querySelectorAll('.pill.drag-over').forEach(p => p.classList.remove('drag-over'));
}

function dragOverPill(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function dragLeavePill(e) {
  e.currentTarget.classList.remove('drag-over');
}

// ── Card-to-card reorder ──────────────────────────────────────────────────
function dragOverCard(e, id) {
  // Ignore if dragging a category pill or hovering the card being dragged.
  if (!draggedId || draggedId === id || draggedCategory) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('card-drag-over');
}

function dragLeaveCard(e) {
  // Only clear when genuinely leaving the card boundary (not moving to a child element).
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('card-drag-over');
  }
}

function dropOnCard(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('card-drag-over');
  if (!draggedId || draggedId === targetId || draggedCategory) { dragEnd(); return; }
  const fromIdx = bookmarks.findIndex(b => b.id === draggedId);
  if (fromIdx === -1) { dragEnd(); return; }
  const [moved] = bookmarks.splice(fromIdx, 1);
  // Re-find target index after removal (fromIdx shift), then insert before it.
  const insertAt = bookmarks.findIndex(b => b.id === targetId);
  if (insertAt === -1) { bookmarks.push(moved); } else { bookmarks.splice(insertAt, 0, moved); }
  saveBookmarks();
  dragEnd();
  renderBookmarks();
}

function dropOnPill(e, cat) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  // Category pill reorder: a pill was dragged onto this pill.
  if (draggedCategory) {
    if (draggedCategory !== cat && cat !== 'All' && cat !== 'Favourites' && cat !== 'Not Assigned') {
      reorderCategory(draggedCategory, cat);
    }
    catPillDragEnd();
    return;
  }

  // Bookmark category change: a card was dragged onto this pill.
  const id = e.dataTransfer.getData('text/plain');
  if (!id || cat === 'All' || cat === 'Favourites' || cat === 'Not Assigned') return;
  const b = bookmarks.find(bm => bm.id === id);
  if (!b || b.category === cat) return;
  b.category = cat;
  saveBookmarks();
  dragEnd();
  renderCategoryPills();
  renderBookmarks();
}
