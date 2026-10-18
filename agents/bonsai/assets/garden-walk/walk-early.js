// ---
// id: 01M48N5GTH9E2TVC4CQDWJJYWQ
// ---
/* The Garden Walk: decides, before the first paint, whether the page is a live interview.
   Adds "live" to <html> unless motion is not welcome, the page is being shown still (#still),
   or the visitor came back to it. walk.js then lets the lines flow in; if it never arrives, "live" is
   taken off again after three seconds so the page is never left hidden. Keeps nothing, sends nothing. */
(() => {
  try {
    const root = document.documentElement;
    const still = /[#&?]still\b/.test(location.hash + location.search);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = performance.getEntriesByType?.('navigation')[0];
    const back = nav && nav.type === 'back_forward';
    if (!still && !reduce && !back) {
      root.classList.add('live');
      setTimeout(() => {
        if (!window.__walkReady) root.classList.remove('live');
      }, 3000);
    }
  } catch {
    /* the page stays as it is, whole */
  }
})();
