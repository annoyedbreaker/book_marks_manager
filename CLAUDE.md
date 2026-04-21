# Bookmarks Manager — CLAUDE.md

## Project Overview

Single-page bookmarks manager with no build step, no framework, no dependencies.
Open `index.html` directly in a browser.

## File Structure

```
book_marks_manager/
├── index.html        HTML skeleton — header, modals, main grid, script tags
├── styles.css        All CSS — design tokens, layout, cards, modal, drag-and-drop, category edit panel
├── CHANGELOG.md
├── CLAUDE.md
├── ChromeProfiles.md Chrome profile reference
├── profile_storage/  Default storage folder — one {Profile Name}.json per profile
│   ├── Ali Ozgec.json
│   ├── acc.ali.ozgec.json
│   ├── n.ec.ali.ozgec.json
│   ├── BASF.json
│   └── Person 1.json
└── js/
    ├── utils.js      esc(), uid()                                  — no dependencies
    ├── state.js      SAMPLES, all let variables                    — no dependencies
    ├── filestore.js  LocalBackend (File System Access API),       — no dependencies
    │                 restoreHandle(), reconnectFolder(),
    │                 chooseFolder(), getFolderName(),
    │                 dispatching top-level read/write/list funcs
    ├── drivestore.js DriveBackend (Google Drive appDataFolder),    — no dependencies
    │                 driveRestore(), driveSignIn(), driveSignOut(),
    │                 driveIsSignedIn(), driveUserEmail()
    │                 (uses Google Identity Services + Drive REST v3)
    ├── storage.js    loadProfiles() [async], saveBookmarks(),      — filestore, utils, state
    │                 saveCustomCategories(), saveCategoryOrder()
    ├── render.js     getCategories(), renderCategoryPills(),       — utils, state
    │                 setCategory(), renderBookmarks(), cardHTML()
    ├── actions.js    toggleFavourite(), handleDelete(), drag*()    — state, storage, render
    ├── modal.js      openModal(), openEditModal(), closeModal(),   — state, storage, render, utils
    │                 overlayClick(), resetForm(), toggleCatMode(),
    │                 populateCatSelect(), handleSubmit()
    ├── profiles.js   switchProfile(), createProfile(),            — state, storage, filestore, render, utils
    │                 renameProfile(), deleteProfile(),
    │                 changeDataFolder(),
    │                 toggleProfileDropdown(), closeProfileDropdown(),
    │                 openProfileModal(), closeProfileModal(),
    │                 renderProfileModal(), updateProfileDisplay()
    ├── categories.js toggleEditCategoriesMode(), renameCategory(), — state, storage, render
    │                 deleteCategory(), addCategory()
    └── app.js        async init(), handleChooseFolder(),           — everything above
    │                 keydown + click listeners
```

**Script load order** (declared at bottom of `index.html`):
`utils → state → filestore → drivestore → storage → render → actions → modal → profiles → categories → app`

All files share the browser's global scope — no `import`/`export`. Each file lists its
dependencies in a leading comment.

## Data Model

```js
// Bookmark (localStorage key: 'bookmarks_v1')
{
  id:        string,   // uid() — base-36 timestamp + random suffix
  title:     string,
  url:       string,   // always normalized to https:// on save
  category:  string,   // '' means uncategorised → displayed as "Not Assigned"
  notes:     string,   // optional, may be empty string
  favourite: boolean,  // defaults to false; migrated on load for older records
  createdAt: string,   // ISO 8601
}

// Custom categories (localStorage key: 'bookmark_cats_v1')
// Array of category name strings that have no bookmarks yet.
// Merged with bookmark-derived categories in getCategories() via Set deduplication.
string[]

// Profile (one file per profile: profile_storage/{Profile Name}.json)
// File content:
{
  id:              string,    // uid() — generated on first load if absent
  bookmarks:       Bookmark[],
  customCategories: string[],
  categoryOrder:   string[],
  isDefault?:      true,      // present only on the locked 'Default' BMP — pinned to the bottom, cannot be renamed or deleted. Auto-created on load if missing.
  lastCategory:    string,    // last category pill the user selected — restored on reload/switch. Defaults to 'All'.
}
// Profile name = filename without .json extension
// Active profile ID stored in localStorage key 'bm_active_profile_v1'
// Directory handle persisted in IndexedDB ('bm_storage' db, 'handles' store, key 'dir')
```

## Key Functions by File

### [js/utils.js](js/utils.js)
| Function | Purpose |
|----------|---------|
| `esc(str)` | HTML-escape — **must wrap all user content before innerHTML** |
| `uid()` | Generate unique bookmark ID |

### [js/state.js](js/state.js)
Defines `STORAGE_KEY`, `SAMPLES`, and all mutable state variables:
`bookmarks`, `activeCategory`, `catMode`, `deleteConfirmId`, `editingId`, `draggedId`

### [js/filestore.js](js/filestore.js)
| Function | Purpose |
|----------|---------|
| `restoreHandle()` | Restore stored dir handle from IndexedDB and `queryPermission` only (no user gesture). Returns `'none'` / `'granted'` / `'needs-permission'` |
| `reconnectFolder()` | Call `requestPermission` on the restored handle — must be invoked from a click handler. Returns `true` on `'granted'` |
| `chooseFolder()` | `showDirectoryPicker()` — user picks a folder; persists handle to IndexedDB |
| `getFolderName()` | Returns the active directory name for display |
| `readProfileFile(name)` | Read `{name}.json`; returns parsed object or `null` |
| `writeProfileFile(name, data)` | Write `{name}.json`; creates file if absent |
| `deleteProfileFile(name)` | Delete `{name}.json`; silent no-op if missing |
| `renameProfileFile(oldName, newName)` | Copy to new filename, delete old |
| `listProfileFiles()` | Return sorted array of profile names (all `*.json` in the folder) |

### [js/storage.js](js/storage.js)
| Function | Purpose |
|----------|---------|
| `loadProfiles()` | **async** — read file, run localStorage migration if needed, hydrate active profile |
| `saveBookmarks()` | Write `bookmarks` into active profile and flush to file |
| `saveCustomCategories()` | Write `customCategories` into active profile and flush to file |
| `saveCategoryOrder()` | Write `categoryOrder` into active profile and flush to file |

### [js/render.js](js/render.js)
| Function | Purpose |
|----------|---------|
| `getCategories()` | Return `['All', 'Favourites', ...sorted unique categories]` |
| `renderCategoryPills()` | Rebuild filter pill bar; wires drop handlers on category pills |
| `setCategory(cat)` | Update `activeCategory`, re-render pills + grid |
| `renderBookmarks()` | Apply category + search filters, render grid or empty state |
| `cardHTML(b)` | Return HTML string for a single bookmark card |

### [js/actions.js](js/actions.js)
| Function | Purpose |
|----------|---------|
| `toggleFavourite(id)` | Toggle `favourite` flag, save, re-render |
| `handleDelete(id)` | Two-click confirmation delete (auto-resets after 3 s) |
| `dragStart(e, id)` | Store dragged ID, set ghost, highlight pills as drop zones |
| `dragEnd()` | Clean up all drag CSS classes and state |
| `dragOverPill(e)` | Highlight pill on hover during drag |
| `dragLeavePill(e)` | Remove pill highlight |
| `dropOnPill(e, cat)` | Reassign bookmark category, save, re-render |

### [js/modal.js](js/modal.js)
| Function | Purpose |
|----------|---------|
| `openModal()` | Show add-bookmark modal |
| `openEditModal(id)` | Pre-fill modal with existing bookmark data |
| `closeModal()` | Hide modal, clear `editingId` |
| `overlayClick(e)` | Close on backdrop click |
| `resetForm()` | Clear fields, hide errors, reset `catMode` |
| `toggleCatMode()` | Switch category field between `<select>` and `<input>` |
| `populateCatSelect()` | Fill dropdown with current categories |
| `handleSubmit(e)` | Validate, normalise URL, add or update bookmark |

### [js/categories.js](js/categories.js)
| Function | Purpose |
|----------|---------|
| `toggleEditCategoriesMode()` | Toggle edit panel open/closed, re-render pills |
| `renameCategory(oldName, newName)` | Rename across all bookmarks + customCategories; merges if newName exists |
| `deleteCategory(catName)` | Set all bookmarks in category to `''` (Not Assigned); remove from customCategories |
| `addCategory(name)` | Add a new empty category to customCategories; no-op if already exists |
| `openImportPanel()` / `doImport()` | Open inline panel to import categories (+ bookmarks, deduped by URL) from another profile |
| `openPromotePanel(cat)` / `confirmPromote()` / `promoteOverwrite()` | Move a category's bookmarks into a new profile in the active Chrome profile. Collisions prompt Overwrite or Rename (Default = overwrite-only) |

### [js/profiles.js](js/profiles.js)
| Function | Purpose |
|----------|---------|
| `switchProfile(id)` | Activate a profile, rehydrate state, re-render grid + pills |
| `createProfile(name, copyFromId)` | Create new profile, optionally deep-cloning another |
| `renameProfile(id, newName)` | Rename profile; updates header button |
| `deleteProfile(id)` | Remove profile; switches away if it was active; min 1 enforced |
| `copyBmpTo(id, targetCpId, mode, newName)` | Copy BMP (deep clone) into another Chrome profile. `mode`: `null` (auto), `'overwrite'`, `'rename'`. Returns `{status:'done'\|'collision'\|'error', targetIsDefault?}` |
| `moveBmpTo(id, targetCpId, mode, newName)` | Same as copyBmpTo but deletes source after. Blocked when source is Default. |
| `changeDataFolder()` | **async** — `chooseFolder()` then reload; switches the active data file |
| `toggleProfileDropdown(e)` | Open/close profile switcher dropdown |
| `closeProfileDropdown()` | Hide dropdown |
| `openProfileModal()` | Open profile editor modal |
| `closeProfileModal()` | Close profile editor modal |
| `renderProfileModal()` | Rebuild folder info + profile list + add-form inside the modal |
| `updateProfileDisplay()` | Refresh header button text with active profile name |

### [js/app.js](js/app.js)
Async `init()` — calls `restoreHandle()` first and branches on the result: `'granted'` →
`loadAndRender()`; `'needs-permission'` → `showReconnectOverlay()` (the minimal one-click
re-auth overlay); `'none'` → show the full first-run folder picker. `handleChooseFolder()` is
wired to the first-run "Choose Folder" button; `handleReconnect()` is wired to the reconnect
overlay button and calls `reconnectFolder()` in-gesture. `loadAndRender()` is the shared
post-authorization sequence. Also registers `Escape` (closes both modals) and global `click`
(closes profile dropdown) listeners.

## CSS Design System ([styles.css](styles.css))

All colours and shared values are CSS custom properties on `:root`:
```
--blue / --blue-dark / --blue-light
--bg / --surface / --text / --muted / --border / --danger / --gold
--radius (12px) / --shadow
```

Responsive grid breakpoints:
- ≥ 1024 px → 3 columns
- 640–1023 px → 2 columns
- < 640 px → 1 column

Animations: `fadeIn` (cards on render), `slideUp` (modal open).
Drag-and-drop classes: `.card.dragging`, `.pills.drag-active`, `.pill.drag-over`.
Category edit panel classes: `.cat-edit-panel`, `.cat-edit-row`, `.cat-edit-input`, `.btn-cat-action`, `.btn-cat-done`, `.btn-edit-cats`.
Special pill variants: `.pill-fav` (gold), `.pill-unassigned` (dashed muted).

## Security Rules

- **Always use `esc()`** before inserting any user-supplied string into `innerHTML`.
- URL is escaped with `esc()` before being placed in `href`.
- All external links use `rel="noopener noreferrer"`.
- URL protocol is normalised (`https://` prepended if missing) and validated with `new URL()` before saving.

## Development Notes

- No build step. Open `index.html` directly in a browser (Chrome / Edge — File System Access API required).
- To reset data during testing: delete or rename `bookmarks.json` in the chosen folder, then reload.
- To force the first-run folder picker: clear IndexedDB (`bm_storage`) in DevTools → Application → IndexedDB.
- New bookmarks are `unshift`ed (prepended) so they appear first in the grid.
- If the last bookmark in a category is deleted, `activeCategory` resets to `'All'` automatically.
- Categories in the filter pills are sorted alphabetically; "All" and "Favourites" are always first.
- When a new functionality is requested, iterate the change log in CHANGELOG.md.
- Ask questions if you need.
- Drag-and-drop uses the HTML5 DnD API (desktop only — no touch support).
- Ask me if I would like to update the update ChromeProfiles.md file. If yes, then update ChromeProfiles.md file with the list of chrome profiles that are available in my chrome browser. Keep the same structure. 
