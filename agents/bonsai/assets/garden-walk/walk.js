// ---
// id: 01M48HX05J4SGATNHGAPFBBFYK
// ---
/* The Garden Walk, page behaviour (Eisai, 2026-10-06, draft 0.1).
   Progressive enhancement only: every page reads and works without this file.
   It never stores, sends or logs anything. What you type here stays on this page and goes
   when the page does. Nothing in it reaches a network. */
(() => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: a classic <script src>, not a module; the directive is live here
  'use strict';
  var d = document,
    root = d.documentElement;
  root.classList.add('js');
  var $ = (s, c) => (c || d).querySelector(s);
  var $$ = (s, c) => Array.prototype.slice.call((c || d).querySelectorAll(s));

  /* A preview that follows what is typed: [data-bind="key"] fields fill [data-fill="key"] spots. */
  function bind() {
    var inputs = $$('[data-bind]');
    if (!inputs.length) return;
    function paint(key, val) {
      $$(`[data-fill="${key}"]`).forEach((el) => {
        var empty = el.getAttribute('data-empty') || '';
        var has = val?.trim();
        el.textContent = has ? val.trim() : empty;
        el.classList.toggle('empty', !has);
        var block = el.closest('[data-hide-empty]');
        if (block) block.hidden = !has;
      });
    }
    inputs.forEach((el) => {
      el.addEventListener('input', () => {
        paint(el.getAttribute('data-bind'), el.value);
      });
    });
  }

  /* Stage 2: "I don't know" is an answer, and it is written down as one. */
  function idk() {
    $$('[data-idk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        var thread = $('#thread');
        if (!thread) return;
        var a = d.createElement('div');
        a.className = 'a idk';
        a.innerHTML = '<small>You said</small>I don’t know yet.';
        thread.appendChild(a);
        var open = $('[data-fill="open"]');
        if (open) {
          open.textContent = btn.getAttribute('data-idk');
          open.classList.remove('empty');
        }
      });
    });
  }

  /* Stage 4: two states of the lens look, switched by a tab; both are in the page without script. */
  function tabs() {
    $$('[role=tablist]').forEach((list) => {
      var buttons = $$('[role=tab]', list);
      var panels = buttons.map((b) => d.getElementById(b.getAttribute('aria-controls')));
      function show(i) {
        buttons.forEach((b, k) => {
          b.setAttribute('aria-selected', k === i ? 'true' : 'false');
        });
        panels.forEach((p, k) => {
          if (p) p.hidden = k !== i;
        });
        var w = $('.walk');
        if (w) w.setAttribute('data-lens', i === 1 ? 'look' : 'ok');
      }
      buttons.forEach((b, i) => {
        b.addEventListener('click', () => {
          show(i);
        });
      });
      show(0);
    });
  }

  /* The turn: a line in their own words enables the next step and is shown with today's date. */
  function turn() {
    var say = $('#sayit'),
      go = $('#goon'),
      rec = $('#recorded');
    if (!say || !go) return;
    go.setAttribute('aria-disabled', 'true');
    go.addEventListener('click', (e) => {
      if (go.getAttribute('aria-disabled') === 'true') e.preventDefault();
    });
    say.addEventListener('input', () => {
      var on = say.value.trim().length > 2;
      go.setAttribute('aria-disabled', on ? 'false' : 'true');
      if (rec) {
        rec.classList.toggle('on', on);
        const when = new Date().toISOString().slice(0, 10);
        rec.textContent = on ? `Recorded, ${when}: “${say.value.trim().slice(0, 140)}”` : '';
      }
    });
  }

  /* Planting: copy a command so your own hand can run it. */
  function copy() {
    $$('.cmd button').forEach((b) => {
      b.addEventListener('click', () => {
        var code = $('code', b.parentNode);
        if (!code || !navigator.clipboard) return;
        navigator.clipboard.writeText(code.textContent).then(
          () => {
            var t = b.textContent;
            b.textContent = 'copied';
            setTimeout(() => {
              b.textContent = t;
            }, 1400);
          },
          () => {},
        );
      });
    });
  }

  /* Sealing: both seals close together. */
  function seal() {
    var wrap = $('[data-seals]'),
      btn = $('#sealbtn');
    if (!wrap || !btn) return;
    btn.addEventListener('click', () => {
      wrap.classList.add('sealed');
      btn.setAttribute('aria-disabled', 'true');
      var done = $('#sealed-note');
      if (done) done.hidden = false;
    });
  }

  /* The storyboard scales each page into its frame. */
  function board() {
    $$('.shot .frame').forEach((f) => {
      function fit() {
        f.style.setProperty('--k', (f.clientWidth / 1280).toFixed(4));
      }
      fit();
      window.addEventListener('resize', fit);
    });
  }

  /* A live interview, written as by hand: Bonsai's lines flow in word by word, each one easing out of a
     soft blur with a slight rise, on an uneven rhythm that breathes at commas and full stops. No caret,
     no ticking. The gardener's side rises in behind the first line. The text is whole in the page and is
     only let in: any click or key finishes it at once. Under reduced motion, #still, or a return visit,
     walk-early.js never sets "live" and none of this runs. */
  function live() {
    var root = d.documentElement;
    if (!root.classList.contains('live')) {
      window.__walkReady = true;
      return;
    }
    var TYPE =
      '.w-voice .say, .w-voice .aside, .gate-box h1, .gate-box .say, .turn-wrap > .say, .sayit h2, .q, .follow';
    var RISE =
      '.w-side > *, .turn-wrap > *:not(.say):not(:first-child), .gate-box > .row, .gate-box > .langpick, .gate-box > .eyebrow:last-child';
    var els = $$(TYPE);
    if (!els.length || !Element.prototype.animate) {
      window.__walkReady = true;
      root.classList.remove('live');
      return;
    }

    function prepare(el) {
      var words = [];
      (function wrap(node) {
        Array.prototype.slice.call(node.childNodes).forEach((n) => {
          if (n.nodeType === 3) {
            const frag = d.createDocumentFragment();
            n.nodeValue.split(/(\s+)/).forEach((tok) => {
              if (!tok) return;
              if (/^\s+$/.test(tok)) {
                frag.appendChild(d.createTextNode(tok));
                return;
              }
              var w = d.createElement('span');
              w.className = 'w';
              w.textContent = tok;
              frag.appendChild(w);
              words.push(w);
            });
            node.replaceChild(frag, n);
          } else if (n.nodeType === 1) {
            wrap(n);
          }
        });
      })(el);
      return { el: el, words: words, big: el.matches('h1, .lead, .q, .follow') };
    }

    function notWaiting(el) {
      return !el.classList.contains('after-choice');
    }
    var items = els.map(prepare);
    var anims = [],
      timers = [],
      skipped = false;
    function at(ms, fn) {
      timers.push(setTimeout(fn, ms));
    }
    function risen(list, from, step) {
      list.forEach((el, k) => {
        at(from + k * step, () => {
          el.classList.add('rose');
        });
      });
    }

    /* the timeline: when each word starts. Short words come quick, a comma or a stop lets the line breathe,
       and the pace drifts a little, so it reads as a hand rather than a clock. */
    var t = 700,
      drift = 1,
      firstDone = 0;
    items.forEach((it, i) => {
      var start = t;
      at(start, () => {
        it.el.classList.add('ready');
      });
      it.words.forEach((w) => {
        drift += (Math.random() - 0.5) * 0.14;
        drift = Math.max(0.82, Math.min(1.22, drift));
        var len = w.textContent.length,
          end = w.textContent.slice(-1);
        var step = (62 + len * 15) * drift * (it.big ? 1.35 : 1);
        var wait = /[.?!]/.test(end) ? 380 : /[,;:—]/.test(end) ? 190 : 0;
        var a = w.animate(
          [
            { opacity: 0, transform: 'translateY(.34em)', filter: 'blur(5px)' },
            { opacity: 0.85, transform: 'translateY(.04em)', filter: 'blur(.8px)', offset: 0.62 },
            { opacity: 1, transform: 'none', filter: 'blur(0)' },
          ],
          { duration: it.big ? 1100 : 880, delay: t, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' },
        );
        anims.push(a);
        t += step + wait;
      });
      if (i === 0) firstDone = t;
      t += it.el.matches('.aside') ? 260 : 420; // a breath between lines
    });

    var hasVoice = !!$('.w-voice');
    var rise = $$(RISE).filter(notWaiting);
    risen(rise, hasVoice ? Math.max(500, firstDone - 400) : t - 600, 340);
    window.__walkReady = true;

    function finish() {
      if (skipped) return;
      skipped = true;
      timers.forEach(clearTimeout);
      items.forEach((it) => {
        it.el.classList.add('ready');
      });
      anims.forEach((a) => {
        a.finish();
      });
      $$(RISE).forEach((el) => {
        el.classList.add('rose');
      });
    }
    ['pointerdown', 'keydown'].forEach((ev) => {
      d.addEventListener(ev, finish, { once: true });
    });
  }

  /* The human picks the language we talk in: the page takes it as its own, locally, and says so. */
  function lang() {
    var sel = $('[data-lang-pick]');
    if (!sel) return;
    sel.addEventListener('change', () => {
      d.documentElement.lang = sel.value === 'x' ? 'en' : sel.value;
      var h = $('#g-lang-h');
      if (h)
        h.textContent =
          sel.value === 'x'
            ? "Tell me which, and I'll use it."
            : 'Noted: we talk in ' +
              sel.options[sel.selectedIndex].text +
              '. The preview pages stay in English for now.';
    });
  }

  /* Step one: what follows the three ways in is shown only once one is chosen, then part by part. */
  function choose() {
    var side = $('.w-side'),
      radios = $$('.ways input[type=radio]');
    if (!side || !radios.length) return;
    function go() {
      if (side.classList.contains('chosen')) return;
      side.classList.add('chosen');
      var later = $$('.after-choice', side);
      later.forEach((el) => {
        el.classList.add('later');
      });
      later.forEach((el, k) => {
        setTimeout(
          () => {
            el.classList.remove('later');
            el.classList.add('show');
          },
          700 + k * 650,
        );
      });
    }
    radios.forEach((r) => {
      r.addEventListener('change', go);
    });
  }

  function start() {
    bind();
    idk();
    tabs();
    turn();
    copy();
    seal();
    board();
    lang();
    choose();
    live();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})();
