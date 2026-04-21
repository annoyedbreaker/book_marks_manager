# Changelog — Bookmarks Manager

All notable changes to this project are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.7.0] — Current

### Added
- **Google Drive storage backend.** You can now store your bookmarks in your own Google Drive instead of (or in addition to) a local folder. Each user signs in with their own Google account; data lives in the hidden `appDataFolder` space of their own Drive — invisible to anyone else, including the app author. First-run screen now offers both options side-by-side.
- **One-time local → Drive migration.** If you had local-folder data before and sign in to Drive for the first time, every existing profile JSON (plus the order file) is uploaded to your Drive automatically.
- **Backend switching from the Profiles modal.** The "Storage" row now lets you switch between Local folder and Google Drive at any time.

### Technical
- New [js/drivestore.js](js/drivestore.js) with `DriveBackend` (mirrors `LocalBackend` surface) and connection helpers `driveSignIn` / `driveRestore` / `driveSignOut` / `driveIsSignedIn` / `driveUserEmail`. Uses Google Identity Services token client (`google.accounts.oauth2.initTokenClient`) with scope `drive.appdata`, plus Drive REST v3 for file CRUD.
- [js/filestore.js](js/filestore.js) refactored: file-ops now live on a `LocalBackend` object. Top-level `readProfileFile` / `writeProfileFile` / etc. dispatch to `activeBackend` (set via `setActiveBackend`).
- OAuth Client ID is hardcoded in `drivestore.js`; origin lockdown is enforced by Google based on the "Authorized JavaScript origins" list in Google Cloud Console.

---

## [2.6.0]

### Added
- **Import categories from another profile.** Inside the Edit Categories panel, a new "Import from…" control lets you pick another bookmark profile, select any subset of its categories, and pull them in along with their bookmarks. Bookmarks are deduped by URL against the target.
- **Promote a category to its own profile.** Each category row now has a `↗ Promote` button. It moves all bookmarks in that category into a brand-new bookmark profile (in the active Chrome profile) and removes them from the source. If the chosen name collides with an existing profile, you get the same Overwrite / Rename prompt used for Copy/Move; Default-name collisions are overwrite-only.

### Technical
- New module state `importState` / `promoteState` in [js/state.js](js/state.js) drives the inline panels.
- Logic lives in [js/categories.js](js/categories.js) (`openImportPanel`, `doImport`, `openPromotePanel`, `_attemptPromote`, `confirmPromote`, `promoteOverwrite`). UI is rendered by [js/render.js](js/render.js) inside the edit-categories panel.

---

## [2.5.0]

### Added
- **Remembers last open category per profile.** Each bookmark profile now stores its last-active category pill and restores it on page reload or profile switch. New profiles start on `All`.
- **Copy / Move profiles across Chrome profiles.** Each profile row in the profile modal now has inline `Copy ▾` and `Move ▾` buttons (Default shows only `Copy ▾`). You pick a target Chrome profile; if the target already has a profile with the same name, you're prompted to Overwrite or Rename. Rename is hidden when the collision is with the target's locked Default — Default can only be overwritten.

### Fixed
- **Grid no longer scrolls sideways** when a card contains a long unbroken string. Grid columns now use `minmax(0, 1fr)`, and note text breaks anywhere if needed.

### Technical
- BMP JSON now persists `lastCategory`. `_hydrateFromActiveProfile` owns the restore/reset of `activeCategory`; callers no longer set it directly. Category resets from delete/rename paths are routed through `setCategory()` so the new value is saved.
- New functions `copyBmpTo` / `moveBmpTo` in [js/profiles.js](js/profiles.js) handle cross-Chrome-profile transfers with deep-cloned bookmark data.

---

## [2.4.0]

### Added
- **Locked Default profile** — each Chrome profile now always has a `Default` bookmark profile pinned to the bottom of its list. It's auto-created on load if missing and cannot be renamed or deleted. The profile modal shows it with a disabled input and a "Locked" label; the rename/delete buttons are hidden. New profiles created via the + Add form are inserted above it so Default stays last.

### Technical
- BMPs now carry an `isDefault: true` flag (persisted to the Chrome profile JSON). `loadProfiles()` guarantees the invariant on every load; `createProfile` / `renameProfile` / `deleteProfile` all honour the flag.

---

## [2.3.0]

### Fixed
- **No more full folder picker on every reload.** Previously the app called `requestPermission()` on startup (outside a user gesture), which the browser rejects — so the first-run overlay appeared on every load. The stored directory handle is now restored with `queryPermission()` only; when the browser needs re-authorization after a page reload, a minimal *Reconnect* overlay shows the saved folder name and a single button. One click re-authorizes the existing handle without re-opening the directory picker.

### Changed
- `initStorage()` split into `restoreHandle()` (query-only) and `reconnectFolder()` (click-triggered `requestPermission`). `chooseFolder()` and the "Change Data Folder" flow are unchanged.

---

## [2.2.0]

### Added
- **`profile_storage/` folder** — pre-created next to `index.html`. Contains one `.json` file per known Chrome profile, ready to use out of the box:
  - `Ali Ozgec.json` (Chrome Default)
  - `acc.ali.ozgec.json` (Chrome Profile 1)
  - `n.ec.ali.ozgec.json` (Chrome Profile 2)
  - `BASF.json` (Chrome Profile 3)
  - `Person 1.json` (Chrome Profile 6)
- On first run, the app suggests pointing to `profile_storage\` so data is available immediately with no manual setup.

### Changed
- **One file per profile** — instead of a single `bookmarks.json` containing all profiles, each profile is now its own `{Profile Name}.json` file. The profile name is the filename.
- **Renaming a profile** renames the corresponding file on disk. **Deleting a profile** deletes its file. **Creating a profile** creates a new file.
- Migration from v2.1.0's single `bookmarks.json` is handled automatically on first load: each profile is split into its own file and `bookmarks.json` is removed.
- First-run overlay updated to show both `profile_storage\` (default) and Chrome User Data path as suggested locations.

---

## [2.1.0]

### Added
- **File-based storage** — bookmarks are now stored in a `bookmarks.json` file on disk using the browser's File System Access API. Data survives browser cache clears, cookie wipes, and "Clear site data" operations.
- **First-run folder picker** — on first open (or when the stored folder handle is lost), a full-screen overlay prompts the user to choose a data folder. Pointing it at a Chrome User Data profile directory (e.g. `…\Chrome\User Data\Default\`) ties the data to that Chrome profile.
- **Data folder switcher** — a "Data folder: … [Change…]" row at the top of the Profiles modal lets the user switch to a different folder at any time. This is how you "switch Chrome profiles" — pick the `bookmarks.json` in a different Chrome profile's folder.
- New file: [js/filestore.js](js/filestore.js) — File System Access API reads/writes + IndexedDB-based directory handle persistence.

### Changed
- **In-app profiles disconnected from Chrome profiles** — profiles are now purely custom named workspaces. The Chrome profile seeding (`CHROME_PROFILES`) and the `chromeProfile` field on profile objects have been removed. A fresh install creates one profile named "Default".
- `localStorage` is no longer used for primary storage. It is read once on first launch (to migrate v2.0.0 data), then the keys are removed.
- `storage.js` rewritten to delegate all reads/writes to `filestore.js`. `loadProfiles()` is now async.
- `app.js` startup is now async (`init()` awaits `initStorage()` and `loadProfiles()`).
- Script load order updated: `… → state → filestore → storage → render → …`
- Profile dropdown no longer shows Chrome folder names beneath profile names.

### Migration
- **From v2.0.0 (localStorage)**: on first launch after choosing a folder, `bm_profiles_v1` and `bm_active_profile_v1` are automatically migrated into the chosen folder's `bookmarks.json`. The `chromeProfile` field is stripped during migration. localStorage keys are then removed.

---

## [2.0.0]

### Added
- **Multi-profile support** — bookmarks, categories, and category ordering are now fully isolated per profile.
- **Profile switcher** — a profile name button in the header opens a dropdown listing all available profiles. Click any profile to switch instantly; the grid and category pills re-render with that profile's data.
- **Profile editor** — a ✎ button next to the switcher opens a modal where you can:
  - **Rename** any profile (Enter or "Rename" button).
  - **Delete** any profile with a two-click confirmation (auto-resets after 3 s). The last profile cannot be deleted.
  - **Create** a new profile, optionally copying all bookmarks and categories from an existing one.
- **Chrome profile seeding** — on first load (fresh install or migration from a pre-2.0 save), the app seeds one profile entry per Chrome profile found on this machine (`Default`, `Profile 1`, `Profile 2`, `Profile 3`, `Profile 6`).
- New file: [js/profiles.js](js/profiles.js) — all profile CRUD, dropdown, and modal UI.
- New `ChromeProfiles.md` — documents the Chrome profiles available on this machine.

### Changed
- **Data storage refactored**: bookmarks, custom categories, and category order are now stored inside a single `bm_profiles_v1` JSON blob (array of profile objects) instead of three separate localStorage keys. The active profile ID is stored under `bm_active_profile_v1`.
- **Automatic migration**: on first load after upgrading, existing data in `bookmarks_v1`, `bookmark_cats_v1`, and `bookmark_cat_order_v1` is automatically wrapped into the `Default` Chrome profile and the legacy keys are removed.
- `loadBookmarks()`, `loadCustomCategories()`, `loadCategoryOrder()` replaced by a single `loadProfiles()` entry point in `storage.js`.
- `saveBookmarks()`, `saveCustomCategories()`, `saveCategoryOrder()` now write into the active profile object and then flush the full profiles array to localStorage.
- `app.js` startup sequence updated: `loadProfiles()` → `renderCategoryPills()` → `renderBookmarks()` → `updateProfileDisplay()`.
- `Escape` key now also closes the profile modal.
- A global `click` listener closes the profile dropdown when clicking outside it.
- Script load order updated: `… → modal → profiles → categories → app`.

---

## [1.9.0]

### Added
- **Category ordering by drag-and-drop** — categories can now be reordered in two places:
  - **Normal mode**: every real category pill is draggable. Drag it and drop it onto another category pill to insert it before that pill.
  - **Edit mode**: each category row has a `⠿` drag handle on the left. Drag a row and drop it onto another row to insert it before that row.
- Order is persisted in `localStorage` under key `bookmark_cat_order_v1` and survives page reloads.
- New state variables: `categoryOrder` (ordered name array), `draggedCategory` (name being dragged).
- New storage functions: `loadCategoryOrder()`, `saveCategoryOrder()` in `storage.js`.
- New helper `getOrderedRealCats()` in `render.js` — resolves the full ordered list (stored order first, then alphabetical tail for any categories not yet in the order).
- New functions in `categories.js`: `reorderCategory(draggedCat, targetCat)`, `catPillDragStart/End`, `catRowDragStart/Over/Leave/Drop/End`.

### Changed
- `getCategories()` now calls `getOrderedRealCats()` instead of sorting alphabetically.
- `renameCategory` and `deleteCategory` keep `categoryOrder` in sync (rename in place; delete removes the entry).
- `dropOnPill()` in `actions.js` now checks `draggedCategory` first: if set, routes to `reorderCategory`; otherwise falls through to the existing bookmark-category-change logic.
- Pill drag does **not** trigger the `drag-active` dashed-border hint (that hint is only for bookmark card drags).
- New CSS: `.pill.dragging-pill`, `.cat-edit-row.dragging-row`, `.cat-edit-row.row-drag-over` (blue top-border insertion line), `.drag-handle`.

---

## [1.8.0]

### Added
- **Edit Categories mode**: a dashed "✎ Edit" button appears at the end of the category pill bar. Clicking it opens an inline edit panel that replaces the pill bar.
- **Rename category**: each category row shows a text input pre-filled with the current name. Edit the name and click "Rename" (or press Enter). All bookmarks with the old name are updated. If the new name already exists the bookmarks are merged into it.
- **Delete category**: clicking "Delete" on a row removes the category. All bookmarks that belonged to it become uncategorised (`category = ''`).
- **Add category**: an "Add" row at the bottom of the panel lets you create a new empty category (no bookmark required). New categories appear in filter pills and in the modal dropdown immediately.
- **Not Assigned**: a virtual "Not Assigned" pill appears in the filter bar only when one or more bookmarks have no category. Selecting it shows those bookmarks. Uncategorised bookmarks display a grey "Not Assigned" badge on their card. The "Not Assigned" pill is not a drag-and-drop target.
- **Custom categories** persisted in `localStorage` under key `bookmark_cats_v1` so empty categories survive page reloads.
- New file: [js/categories.js](js/categories.js) — `toggleEditCategoriesMode`, `renameCategory`, `deleteCategory`, `addCategory`.

### Changed
- `getCategories()` now merges bookmark-derived categories with `customCategories` (Set-deduplicated) and appends "Not Assigned" conditionally.
- `populateCatSelect()` in `modal.js` includes `customCategories` so newly created empty categories appear in the dropdown immediately.
- `dropOnPill()` in `actions.js` now also guards against drops on the "Not Assigned" pill.
- Script load order updated: `… → modal → categories → app`.

---

## [1.7.0]

### Changed
- **Project split into logical files** — the monolithic `index.html` is now a pure HTML skeleton. All styles and scripts live in dedicated files:
  - [styles.css](styles.css) — entire CSS (design tokens, layout, cards, modal, drag-and-drop)
  - [js/utils.js](js/utils.js) — `esc()`, `uid()`
  - [js/state.js](js/state.js) — `STORAGE_KEY`, `SAMPLES`, all `let` state variables
  - [js/storage.js](js/storage.js) — `loadBookmarks()`, `saveBookmarks()`
  - [js/render.js](js/render.js) — `getCategories()`, `renderCategoryPills()`, `setCategory()`, `renderBookmarks()`, `cardHTML()`
  - [js/actions.js](js/actions.js) — `toggleFavourite()`, `handleDelete()`, all drag-and-drop functions
  - [js/modal.js](js/modal.js) — all modal open/close/reset/submit functions
  - [js/app.js](js/app.js) — `keydown` listener, startup init calls
- `index.html` now loads files via `<link rel="stylesheet">` and `<script src>` tags in dependency order.
- Zero behaviour changes — this is a pure structural refactor.

---

## [1.6.0]

### Added
- **Drag-and-drop category reassignment**: bookmark cards are now draggable. Drag a card and drop it onto any category pill to instantly reassign that bookmark's category — no modal required.
  - While dragging: the card fades to 45% opacity and all valid category pills switch to dashed borders as a drop-zone hint.
  - Hovering over a valid pill highlights it blue and scales it up.
  - Dropping on the same category is a no-op (no data change, no re-render).
  - "All" and "Favourites" pills are not valid drop targets.
  - Releasing outside a pill cancels gracefully with no data change.
  - Favourite flag is preserved when category changes.
- New state variable `draggedId` tracks the card currently being dragged.
- New functions: `dragStart(e, id)`, `dragEnd()`, `dragOverPill(e)`, `dragLeavePill(e)`, `dropOnPill(e, cat)`.
- New CSS classes: `.card.dragging`, `.pills.drag-active`, `.pill.drag-over`.

> Desktop-only: uses the HTML5 Drag and Drop API, which does not fire on touch screens.

---

## [1.5.0]

### Added
- **Favourites**: every bookmark card now has a star button (★) in the top-right corner. Click to favourite; click again to unfavourite. Favourited cards get a gold border highlight.
- **Favourites filter pill**: a dedicated "★ Favourites" pill appears in the filter bar (between "All" and the category pills) and shows only starred bookmarks. When no bookmarks are starred, an empty state explains how to add one.
- **Edit bookmark**: an "Edit" button now appears next to "Delete" in each card footer. Clicking it opens the modal pre-filled with the bookmark's existing title, URL, category, and notes. The modal title changes to "Edit Bookmark" and the submit button reads "Update Bookmark". Saving updates the record in place without changing its `createdAt` or `favourite` state.

### Changed
- Data model: `favourite: boolean` field added (defaults to `false`). Existing stored bookmarks are migrated automatically on load via a spread-merge.
- `openModal()` now explicitly resets `editingId` and sets the correct modal title/button label.
- `closeModal()` also resets `editingId` so a cancelled edit never bleeds into the next add.
- After a successful add or edit, category pills are re-rendered to reflect any new category introduced via editing.
- `activeCategory` is no longer reset to `'All'` after an edit — the user stays in their current view.

---

## [1.4.0]

### Added
- Two-step delete confirmation: first click turns button red and shows "Confirm?"; auto-resets after 3 seconds if not confirmed.
- URL auto-normalisation: `https://` is prepended automatically when the user omits a protocol.
- Category select/input toggle inside the modal: users can pick an existing category from a `<select>` or switch to free-text input via "(or type a new one)" / "(pick existing)" link.
- When no categories exist yet, the modal switches to free-text input mode automatically.
- `aria-modal`, `aria-labelledby`, and `aria-label` attributes added to modal for screen-reader support.

### Changed
- Active category resets to "All" automatically when the last bookmark in that category is deleted.
- New bookmarks are prepended (`unshift`) so the latest entry always appears first in the grid.

---

## [1.3.0]

### Added
- Sticky header — stays visible while scrolling through large bookmark collections.
- Modal close on overlay click (clicking the backdrop outside the modal panel).
- Keyboard shortcut: `Escape` closes the open modal.
- Focus management: modal sets focus to the Title field on open.
- Inline field-level validation errors below each form input (`err-title`, `err-url`, `err-cat`).

### Changed
- Form uses `novalidate` to replace browser-native validation with custom inline error messages.

---

## [1.2.0]

### Added
- Live search bar (filters by title and category on every keystroke).
- Category filter pills above the grid; "All" pill always shown first, remaining categories sorted alphabetically.
- Bookmark count label (`N bookmarks`) that updates with every filter/search change.
- Empty state displayed when no bookmarks match the current filter or search query, with context-aware helper text.
- Responsive grid layout: 3 columns (≥ 1024 px), 2 columns (640–1023 px), 1 column (< 640 px).

### Changed
- Grid uses `CSS Grid` with `repeat(3, 1fr)` and media-query overrides (previously single-column).

---

## [1.1.0]

### Added
- Favicon display per bookmark via Google S2 favicon API (`https://www.google.com/s2/favicons?domain=<host>&sz=32`); falls back to reduced opacity on load error.
- Notes field on cards (clamped to 2 lines with CSS `-webkit-line-clamp`).
- Category badge pill on each card.
- "Added" date displayed in the card footer.
- Card hover animation (`translateY(-3px)` lift with deepened shadow).
- `fadeIn` keyframe animation on card render; `slideUp` animation on modal open.
- Delete button per card (single-click at this stage).
- `esc()` HTML-escape utility applied to all user-supplied content rendered into `innerHTML`.
- External bookmark links use `target="_blank" rel="noopener noreferrer"`.

### Changed
- Card layout restructured into `card-top` / badge / notes / `card-footer` sections.

---

## [1.0.0] — Initial Release

### Added
- Single-file application (`index.html`) — no build step, no external dependencies.
- CSS custom-property design system on `:root`: colour palette (`--blue`, `--bg`, `--surface`, `--text`, `--muted`, `--border`, `--danger`), `--radius`, and `--shadow`.
- `localStorage` persistence using key `bookmarks_v1`; data stored as a JSON array.
- Bookmark data model: `{ id, title, url, category, notes, createdAt }`.
- `uid()` ID generator (base-36 timestamp + random suffix).
- 8 sample bookmarks seeded automatically on first load across 5 categories: Development, Design, Productivity, News, Learning.
- "Add Bookmark" modal with fields: Title, URL, Category, Notes (optional).
- `loadBookmarks()` / `saveBookmarks()` for localStorage read/write.
- Basic card grid rendering via `renderBookmarks()` and `cardHTML()`.
- "Add Bookmark" button in the header opens modal; Cancel and × buttons close it.
