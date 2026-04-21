// Escape a string for safe insertion into HTML.
// Must be called on every piece of user-supplied content before innerHTML use.
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Generate a unique bookmark ID: base-36 timestamp + random suffix.
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
