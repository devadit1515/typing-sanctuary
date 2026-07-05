/* Typing Sanctuary — in-browser statistical keystroke verifier.
   The same family of methods as the 2009 benchmark in the research:
   scaled-Manhattan distance over timing features. Runs entirely
   client-side; profiles live in localStorage. */

(function (root) {
  'use strict';

  /* ---------------- capture ---------------- */

  // Attach to an <input>. Records hold (keydown->keyup) and gap
  // (keydown->keydown) times for printable keys, in order.
  function createCapture(input) {
    let downs = {}, events = [], lastDown = 0;

    function onDown(e) {
      if (e.key.length !== 1) {
        if (e.key === 'Backspace') events.push({ type: 'bksp' });
        return;
      }
      const t = performance.now();
      downs[e.code] = t;
      events.push({ type: 'down', key: e.key.toLowerCase(), t, gap: lastDown ? t - lastDown : null });
      lastDown = t;
    }

    function onUp(e) {
      if (!(e.code in downs)) return;
      const t = performance.now();
      const down = downs[e.code];
      delete downs[e.code];
      events.push({ type: 'up', keyDown: down, hold: t - down });
    }

    input.addEventListener('keydown', onDown);
    input.addEventListener('keyup', onUp);

    return {
      // one repetition's raw timings, in typing order
      collect() {
        const holds = [], gaps = [], keys = [];
        let clean = true;
        for (const ev of events) {
          if (ev.type === 'bksp') clean = false;
          if (ev.type === 'down') { keys.push(ev.key); if (ev.gap !== null) gaps.push(ev.gap); }
          if (ev.type === 'up') holds.push(ev.hold);
        }
        return { holds, gaps, keys, clean };
      },
      reset() { downs = {}; events = []; lastDown = 0; },
      destroy() {
        input.removeEventListener('keydown', onDown);
        input.removeEventListener('keyup', onUp);
      },
    };
  }

  /* ---------------- math ---------------- */

  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const std = a => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  };
  const median = a => {
    const s = [...a].sort((x, y) => x - y);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const quantile = (a, q) => {
    const s = [...a].sort((x, y) => x - y);
    const i = Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))));
    return s[i];
  };

  /* ---------------- password mode (fixed text) ----------------
     Feature vector per repetition: [holds per position..., gaps per position...]
     Profile: per-feature median + spread (MAD-like, floored). */

  function passwordFeatures(rep, length) {
    if (rep.holds.length < length || rep.gaps.length < length - 1) return null;
    return rep.holds.slice(0, length).concat(rep.gaps.slice(0, length - 1));
  }

  function buildFixedProfile(featureRows) {
    const n = featureRows[0].length;
    const mu = [], sig = [];
    for (let i = 0; i < n; i++) {
      const col = featureRows.map(r => r[i]);
      mu.push(median(col));
      // spread floored at 12ms so one robotic column cannot dominate
      sig.push(Math.max(12, std(col)));
    }
    return { mu, sig, reps: featureRows.length };
  }

  function scaledManhattan(profile, features) {
    let d = 0, n = 0;
    for (let i = 0; i < profile.mu.length; i++) {
      if (features[i] === undefined || features[i] === null) continue;
      d += Math.abs(features[i] - profile.mu[i]) / profile.sig[i];
      n++;
    }
    return n ? d / n : Infinity;
  }

  /* ---------------- phrase mode (free text) ----------------
     Aggregate distribution features + per-letter holds + digraph gaps. */

  const LETTERS = ['e', 't', 'a', 'o', 'n', 's', 'h', 'r'];
  const DIGRAPHS = ['th', 'he', 'in', 'er', 'an'];

  function phraseFeatures(rep) {
    if (rep.holds.length < 15 || rep.gaps.length < 14) return null;
    const f = {};
    f.holdMean = mean(rep.holds);
    f.holdStd = std(rep.holds);
    f.gapMedian = median(rep.gaps);
    f.gapStd = std(rep.gaps);
    f.gapP90 = quantile(rep.gaps, 0.9);
    // per-letter holds
    const letterHolds = {};
    rep.keys.forEach((k, i) => {
      if (i < rep.holds.length && LETTERS.includes(k)) {
        (letterHolds[k] = letterHolds[k] || []).push(rep.holds[i]);
      }
    });
    for (const L of LETTERS) {
      f['hold_' + L] = letterHolds[L] && letterHolds[L].length >= 2 ? mean(letterHolds[L]) : null;
    }
    // digraph gaps (gap i sits between key i and key i+1)
    const digraphGaps = {};
    for (let i = 0; i < rep.keys.length - 1 && i < rep.gaps.length; i++) {
      const dg = rep.keys[i] + rep.keys[i + 1];
      if (DIGRAPHS.includes(dg)) (digraphGaps[dg] = digraphGaps[dg] || []).push(rep.gaps[i]);
    }
    for (const D of DIGRAPHS) {
      f['gap_' + D] = digraphGaps[D] && digraphGaps[D].length ? mean(digraphGaps[D]) : null;
    }
    return f;
  }

  function buildPhraseProfile(featureMaps) {
    const names = Object.keys(featureMaps[0]);
    const profile = { mu: {}, sig: {}, reps: featureMaps.length };
    for (const name of names) {
      const col = featureMaps.map(m => m[name]).filter(v => v !== null && v !== undefined);
      if (col.length < Math.max(3, Math.ceil(featureMaps.length / 2))) continue; // feature too sparse
      profile.mu[name] = median(col);
      profile.sig[name] = Math.max(name.startsWith('gap') ? 18 : 10, std(col));
    }
    return profile;
  }

  function phraseDistance(profile, features) {
    let d = 0, n = 0;
    for (const name of Object.keys(profile.mu)) {
      const v = features[name];
      if (v === null || v === undefined) continue;
      d += Math.abs(v - profile.mu[name]) / profile.sig[name];
      n++;
    }
    return n >= 6 ? d / n : Infinity;
  }

  /* ---------------- similarity mapping ----------------
     Distance is in spread units: a genuine repeat typically lands
     around 0.8-1.3, a different person around 2-4. A sigmoid centred
     between the two turns it into a stable, honest percentage. */

  function similarity(d, centre, slope) {
    if (!isFinite(d)) return null;
    const s = 100 / (1 + Math.exp((d - centre) / slope));
    return Math.round(Math.min(99, Math.max(1, s)));
  }

  const similarityFixed = d => similarity(d, 1.9, 0.45);
  const similarityPhrase = d => similarity(d, 1.7, 0.5);

  /* ---------------- storage ---------------- */

  const KEY_FIXED = 'ts_bio_fixed_v1';
  const KEY_PHRASE = 'ts_bio_phrase_v1';

  async function digest(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const store = {
    save(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); },
    load(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
    },
    clear(key) { localStorage.removeItem(key); },
  };

  /* ---------------- phrase bank (lowercase, no punctuation) ---------------- */

  const PHRASES = [
    'the river bends slowly under the old stone bridge',
    'morning light settles over the quiet garden wall',
    'a steady hand draws the longest line',
    'the kettle hums while rain taps the window',
    'soft steps echo down the empty hallway',
    'clouds drift past the tall pine trees',
    'the lamp glows warm on the wooden desk',
    'waves fold gently onto the cold grey sand',
    'a thin path winds between the silver birches',
    'the old clock keeps its own slow time',
    'wind moves through the wheat in long waves',
    'the harbour lights blink across still water',
  ];

  const api = {
    createCapture,
    passwordFeatures, buildFixedProfile, scaledManhattan, similarityFixed,
    phraseFeatures, buildPhraseProfile, phraseDistance, similarityPhrase,
    digest, store, KEY_FIXED, KEY_PHRASE, PHRASES,
    _math: { mean, std, median, quantile },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TSBio = api;
})(typeof window !== 'undefined' ? window : globalThis);
