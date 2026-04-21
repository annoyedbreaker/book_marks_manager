// Seed data shown on first load (when no bookmarks exist in the data file).
const SAMPLES = [
  { title: 'MDN Web Docs',   url: 'https://developer.mozilla.org', category: 'Development', notes: 'The go-to reference for HTML, CSS, and JavaScript APIs.' },
  { title: 'GitHub',         url: 'https://github.com',            category: 'Development', notes: 'Code hosting and version control for all my projects.' },
  { title: 'Can I use…',     url: 'https://caniuse.com',           category: 'Development', notes: 'Check browser compatibility for web features.' },
  { title: 'Figma',          url: 'https://figma.com',             category: 'Design',      notes: 'Collaborative design and prototyping tool.' },
  { title: 'Coolors',        url: 'https://coolors.co',            category: 'Design',      notes: 'Fast color palette generator.' },
  { title: 'Notion',         url: 'https://notion.so',             category: 'Productivity',notes: 'All-in-one workspace for notes and projects.' },
  { title: 'Hacker News',    url: 'https://news.ycombinator.com',  category: 'News',        notes: 'Tech news and discussions.' },
  { title: 'freeCodeCamp',   url: 'https://freecodecamp.org',      category: 'Learning',    notes: 'Free interactive coding lessons and certifications.' },
];

// ── Runtime state ─────────────────────────────────────────────────────────
// Bookmark data model: { id, title, url, category, notes, favourite, createdAt }
let bookmarks = [];

// Currently selected filter pill ('All', 'Favourites', or a category name).
let activeCategory = 'All';

// Category field mode inside the modal: 'select' (existing) or 'input' (new).
let catMode = 'select';

// ID of the bookmark awaiting second-click delete confirmation; null otherwise.
let deleteConfirmId = null;

// ID of the bookmark being edited in the modal; null when adding new.
let editingId = null;

// ID of the card currently being dragged; null when no drag is in progress.
let draggedId = null;

// Whether the category edit panel is open.
let editCategoriesMode = false;

// Categories that exist independently of bookmarks (no bookmark assigned yet).
// Persisted separately in localStorage under CAT_KEY (see storage.js).
let customCategories = [];

// User-defined display order for real categories.
// Persisted in localStorage under CAT_ORDER_KEY (see storage.js).
// Categories not present in this array appear alphabetically after the ordered ones.
let categoryOrder = [];

// Name of the category currently being dragged (pill or edit-row); null otherwise.
let draggedCategory = null;

// Array of all ChromeProfile objects.
// Each ChromeProfile: { id, name, folderName, email, profiles: BMP[] }
// Each BMP (BookMarkManagerProfile): { id, name, bookmarks, customCategories, categoryOrder }
let chromeProfiles = [];

// ID of the currently active ChromeProfile.
let activeChromeProfileId = null;

// Flat list of all BMPs across all ChromeProfiles (shared references into chromeProfiles[x].profiles).
let profiles = [];

// ID of the currently active BMP.
let activeProfileId = null;

// Edit-panel inline UI state.
// importState:   { sourceBmpId, selected: Set<string> } — active when picking categories to import.
// promoteState:  { categoryName, phase: 'pick'|'collision'|'rename', nameValue, targetIsDefault, error }
let importState = null;
let promoteState = null;
