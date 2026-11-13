/* Runs before CSS: appearance never depends on character data or module loading. */
(function (root) {
  'use strict';
  const key = 'questlog.appearance';
  const choices = ['system', 'light', 'dark'];
  const media = root.matchMedia?.('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { preference = normalize(root.localStorage.getItem(key)); } catch { /* Private browsing. */ }
  function normalize(value) { return choices.includes(value) ? value : 'system'; }
  function resolved() { return preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference; }
  function apply() {
    const theme = resolved();
    root.document.documentElement.dataset.theme = theme;
    root.document.documentElement.dataset.themePreference = preference;
    root.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171f1b' : '#e5d9bf');
    root.document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
    root.document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = preference; });
    root.document.dispatchEvent(new root.CustomEvent('questlog:theme', {detail: {preference, theme}}));
  }
  function set(value) {
    preference = normalize(value);
    let persisted = true;
    try { root.localStorage.setItem(key, preference); } catch { persisted = false; }
    apply();
    return persisted;
  }
  root.QuestlogTheme = Object.freeze({get preference() { return preference; }, get theme() { return resolved(); }, set});
  media?.addEventListener('change', () => { if (preference === 'system') apply(); });
  root.addEventListener('storage', event => { if (event.key === key || event.key === null) { preference = normalize(event.newValue); apply(); } });
  root.document.addEventListener('change', event => { if (event.target.matches('[data-theme-select]')) set(event.target.value); });
  apply();
})(window);
