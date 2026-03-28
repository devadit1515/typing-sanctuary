/**
 * Feature Engineering Module
 *
 * Extracts a 200-dimensional feature vector from raw keystroke data using
 * 7 feature groups based on keystroke dynamics literature (Killourhy & Maxion
 * 2009, Alsultan et al. 2017).
 *
 * Feature groups:
 *   A. Global timing statistics (30 features)
 *   B. Per-key dwell times (40 features)
 *   C. Digraph features (90 features)
 *   D. Trigraph features (15 features)
 *   E. Rhythm & autocorrelation (12 features)
 *   F. Hand/finger transitions (8 features)
 *   G. Error dynamics (5 features)
 *
 * Total: 200 raw features
 */

// ── Constants ──────────────────────────────────────────────────────

/** Top 20 most frequent English characters (+ space as ' ') */
const TOP_KEYS = [
  ' ', 'e', 't', 'a', 'o', 'i', 'n', 's', 'h', 'r',
  'd', 'l', 'c', 'u', 'm', 'w', 'f', 'g', 'y', 'p'
];

/** Top 30 most common English digraphs */
const TOP_DIGRAPHS = [
  'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd',
  'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar',
  'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le'
];

/** Top 15 most common English trigraphs */
const TOP_TRIGRAPHS = [
  'the', 'ing', 'and', 'ion', 'tio', 'ent', 'ati', 'for', 'her',
  'ter', 'hat', 'tha', 'ere', 'ate', 'his'
];

/**
 * QWERTY keyboard layout mapping for hand/finger/row analysis.
 * hand: 'L' (left) or 'R' (right)
 * row: 0 = top (qwerty), 1 = home (asdf), 2 = bottom (zxcv)
 * finger: 0=pinky, 1=ring, 2=middle, 3=index (from outside in)
 */
const QWERTY_MAP = {};
const LAYOUT = [
  // Top row
  { chars: 'qQ', hand: 'L', row: 0, finger: 0 },
  { chars: 'wW', hand: 'L', row: 0, finger: 1 },
  { chars: 'eE', hand: 'L', row: 0, finger: 2 },
  { chars: 'rR', hand: 'L', row: 0, finger: 3 },
  { chars: 'tT', hand: 'L', row: 0, finger: 3 },
  { chars: 'yY', hand: 'R', row: 0, finger: 3 },
  { chars: 'uU', hand: 'R', row: 0, finger: 3 },
  { chars: 'iI', hand: 'R', row: 0, finger: 2 },
  { chars: 'oO', hand: 'R', row: 0, finger: 1 },
  { chars: 'pP', hand: 'R', row: 0, finger: 0 },
  // Home row
  { chars: 'aA', hand: 'L', row: 1, finger: 0 },
  { chars: 'sS', hand: 'L', row: 1, finger: 1 },
  { chars: 'dD', hand: 'L', row: 1, finger: 2 },
  { chars: 'fF', hand: 'L', row: 1, finger: 3 },
  { chars: 'gG', hand: 'L', row: 1, finger: 3 },
  { chars: 'hH', hand: 'R', row: 1, finger: 3 },
  { chars: 'jJ', hand: 'R', row: 1, finger: 3 },
  { chars: 'kK', hand: 'R', row: 1, finger: 2 },
  { chars: 'lL', hand: 'R', row: 1, finger: 1 },
  // Bottom row
  { chars: 'zZ', hand: 'L', row: 2, finger: 0 },
  { chars: 'xX', hand: 'L', row: 2, finger: 1 },
  { chars: 'cC', hand: 'L', row: 2, finger: 2 },
  { chars: 'vV', hand: 'L', row: 2, finger: 3 },
  { chars: 'bB', hand: 'L', row: 2, finger: 3 },
  { chars: 'nN', hand: 'R', row: 2, finger: 3 },
  { chars: 'mM', hand: 'R', row: 2, finger: 3 },
  // Space
  { chars: ' ', hand: 'R', row: 3, finger: 3 }
];

for (const entry of LAYOUT) {
  for (const ch of entry.chars) {
    QWERTY_MAP[ch] = { hand: entry.hand, row: entry.row, finger: entry.finger };
  }
}

// Also map lowercase explicitly if not already
for (const entry of LAYOUT) {
  for (const ch of entry.chars) {
    const lower = ch.toLowerCase();
    if (!QWERTY_MAP[lower]) {
      QWERTY_MAP[lower] = { hand: entry.hand, row: entry.row, finger: entry.finger };
    }
  }
}

/**
 * Total feature count per group.
 * A=30, B=40, C=90, D=15, E=12, F=8, G=5 = 200
 */
const FEATURE_COUNT = 200;
const GROUP_OFFSETS = {
  A: 0,    // 30 features: global timing stats
  B: 30,   // 40 features: per-key dwell
  C: 70,   // 90 features: digraphs
  D: 160,  // 15 features: trigraphs
  E: 175,  // 12 features: rhythm/autocorrelation
  F: 187,  // 8 features: hand/finger transitions
  G: 195   // 5 features: error dynamics
};

// ── Statistical Helpers ────────────────────────────────────────────

function mean(arr) {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(arr, mu) {
  if (arr.length < 2) return 0;
  if (mu === undefined) mu = mean(arr);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - mu;
    sum += d * d;
  }
  return Math.sqrt(sum / (arr.length - 1));
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

function skewness(arr, mu, sd) {
  if (arr.length < 3 || sd === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const z = (arr[i] - mu) / sd;
    sum += z * z * z;
  }
  return sum / arr.length;
}

function kurtosis(arr, mu, sd) {
  if (arr.length < 4 || sd === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const z = (arr[i] - mu) / sd;
    sum += z * z * z * z;
  }
  return (sum / arr.length) - 3; // Excess kurtosis
}

/**
 * Compute 10 distribution statistics for an array of values.
 * Returns [mean, median, stdDev, IQR, skewness, kurtosis, p10, p25, p75, p90]
 */
function distributionStats(values) {
  if (values.length === 0) return new Array(10).fill(0);

  const sorted = values.slice().sort((a, b) => a - b);
  const mu = mean(values);
  const med = median(values); // Could use sorted directly
  const sd = stdDev(values, mu);
  const p25 = percentile(sorted, 25);
  const p75 = percentile(sorted, 75);

  return [
    mu,
    med,
    sd,
    p75 - p25,                    // IQR
    skewness(values, mu, sd),
    kurtosis(values, mu, sd),
    percentile(sorted, 10),
    p25,
    p75,
    percentile(sorted, 90)
  ];
}

// ── Core Feature Extraction ────────────────────────────────────────

/**
 * Extract a 200-dimensional feature vector from raw keystroke data.
 *
 * @param {Array} keystrokes - Array of keystroke objects from the frontend:
 *   { char, keyCode, dwellTime, flightTime, position, isCorrect, timestamp }
 * @returns {{ vector: number[], featureNames: string[], observed: boolean[], metadata: object } | null}
 */
function extractFeatureVector(keystrokes) {
  if (!keystrokes || keystrokes.length < 5) return null;

  // Filter valid keystrokes (reasonable timing bounds)
  const valid = keystrokes.filter(k =>
    k.dwellTime != null && k.dwellTime >= 0 && k.dwellTime < 5000 &&
    k.timestamp != null
  );

  if (valid.length < 5) return null;

  const vector = new Array(FEATURE_COUNT).fill(0);
  const observed = new Array(FEATURE_COUNT).fill(false);
  const featureNames = buildFeatureNames();

  // ── Compute three core timing vectors ──

  // H (Hold/Dwell): already available
  const H = valid.map(k => k.dwellTime);

  // DD (Down-Down): timestamp[i] - timestamp[i-1]
  const DD = [];
  for (let i = 1; i < valid.length; i++) {
    const dd = valid[i].timestamp - valid[i - 1].timestamp;
    if (dd >= 0 && dd < 10000) DD.push(dd);
  }

  // UD (Up-Down / Flight): already available, but recompute for consistency
  const UD = [];
  for (let i = 1; i < valid.length; i++) {
    const ud = valid[i].flightTime;
    if (ud != null && ud >= 0 && ud < 10000) UD.push(ud);
  }

  // ── Group A: Global Timing Statistics (30 features) ──
  const timingArrays = [H, DD, UD];
  const timingNames = ['H', 'DD', 'UD'];
  for (let t = 0; t < 3; t++) {
    const stats = distributionStats(timingArrays[t]);
    const offset = GROUP_OFFSETS.A + t * 10;
    for (let s = 0; s < 10; s++) {
      vector[offset + s] = stats[s];
      observed[offset + s] = timingArrays[t].length >= 3;
    }
  }

  // ── Group B: Per-Key Dwell Features (40 features) ──
  const perKeyDwells = {};
  for (const k of valid) {
    const ch = k.char ? k.char.toLowerCase() : null;
    if (!ch) continue;
    if (!perKeyDwells[ch]) perKeyDwells[ch] = [];
    perKeyDwells[ch].push(k.dwellTime);
  }

  const globalDwellMean = mean(H);
  for (let i = 0; i < TOP_KEYS.length; i++) {
    const key = TOP_KEYS[i];
    const offset = GROUP_OFFSETS.B + i * 2;
    const dwells = perKeyDwells[key];
    if (dwells && dwells.length >= 2) {
      vector[offset] = mean(dwells);
      vector[offset + 1] = stdDev(dwells);
      observed[offset] = true;
      observed[offset + 1] = true;
    } else {
      // Impute with global mean, stdDev=0
      vector[offset] = globalDwellMean;
      vector[offset + 1] = 0;
    }
  }

  // ── Group C: Digraph Features (90 features) ──
  // For each digraph: mean DD, mean UD, mean combined-hold (H1+H2)
  const digraphData = {}; // key -> { dd: [], ud: [], hold: [] }
  for (let i = 1; i < valid.length; i++) {
    const c1 = valid[i - 1].char ? valid[i - 1].char.toLowerCase() : '';
    const c2 = valid[i].char ? valid[i].char.toLowerCase() : '';
    const digraph = c1 + c2;
    if (!digraphData[digraph]) digraphData[digraph] = { dd: [], ud: [], hold: [] };

    const dd = valid[i].timestamp - valid[i - 1].timestamp;
    const ud = valid[i].flightTime;
    const combinedHold = valid[i - 1].dwellTime + valid[i].dwellTime;

    if (dd >= 0 && dd < 10000) digraphData[digraph].dd.push(dd);
    if (ud != null && ud >= 0 && ud < 10000) digraphData[digraph].ud.push(ud);
    if (combinedHold >= 0 && combinedHold < 10000) digraphData[digraph].hold.push(combinedHold);
  }

  const globalDDMean = mean(DD);
  const globalUDMean = UD.length > 0 ? mean(UD) : 0;
  const globalHoldMean = globalDwellMean * 2;
  let digraphsCovered = 0;

  for (let i = 0; i < TOP_DIGRAPHS.length; i++) {
    const dg = TOP_DIGRAPHS[i];
    const offset = GROUP_OFFSETS.C + i * 3;
    const data = digraphData[dg];

    if (data && data.dd.length >= 2) {
      vector[offset] = mean(data.dd);
      vector[offset + 1] = mean(data.ud);
      vector[offset + 2] = mean(data.hold);
      observed[offset] = true;
      observed[offset + 1] = true;
      observed[offset + 2] = true;
      digraphsCovered++;
    } else if (data && data.dd.length === 1) {
      // Single observation — use it but mark partially observed
      vector[offset] = data.dd[0];
      vector[offset + 1] = data.ud.length > 0 ? data.ud[0] : globalUDMean;
      vector[offset + 2] = data.hold.length > 0 ? data.hold[0] : globalHoldMean;
      observed[offset] = true;
      observed[offset + 1] = data.ud.length > 0;
      observed[offset + 2] = data.hold.length > 0;
      digraphsCovered++;
    } else {
      // Impute with global means
      vector[offset] = globalDDMean;
      vector[offset + 1] = globalUDMean;
      vector[offset + 2] = globalHoldMean;
    }
  }

  // ── Group D: Trigraph Features (15 features) ──
  const trigraphData = {}; // key -> [totalTime, ...]
  for (let i = 2; i < valid.length; i++) {
    const c1 = valid[i - 2].char ? valid[i - 2].char.toLowerCase() : '';
    const c2 = valid[i - 1].char ? valid[i - 1].char.toLowerCase() : '';
    const c3 = valid[i].char ? valid[i].char.toLowerCase() : '';
    const trigraph = c1 + c2 + c3;
    const totalTime = valid[i].timestamp - valid[i - 2].timestamp;
    if (totalTime >= 0 && totalTime < 15000) {
      if (!trigraphData[trigraph]) trigraphData[trigraph] = [];
      trigraphData[trigraph].push(totalTime);
    }
  }

  const globalTrigraphMean = DD.length > 0 ? mean(DD) * 2 : 0;
  let trigraphsCovered = 0;

  for (let i = 0; i < TOP_TRIGRAPHS.length; i++) {
    const tg = TOP_TRIGRAPHS[i];
    const offset = GROUP_OFFSETS.D + i;
    const data = trigraphData[tg];

    if (data && data.length >= 1) {
      vector[offset] = mean(data);
      observed[offset] = data.length >= 2;
      trigraphsCovered++;
    } else {
      vector[offset] = globalTrigraphMean;
    }
  }

  // ── Group E: Rhythm & Autocorrelation (12 features) ──
  const rhythmOffset = GROUP_OFFSETS.E;

  if (DD.length >= 10) {
    const ddMu = mean(DD);
    const ddSd = stdDev(DD, ddMu);
    const ddVar = ddSd * ddSd;

    // Autocorrelation at lags 1-5
    for (let lag = 1; lag <= 5; lag++) {
      let autoCorr = 0;
      if (ddVar > 0 && DD.length > lag) {
        let sum = 0;
        const count = DD.length - lag;
        for (let i = 0; i < count; i++) {
          sum += (DD[i] - ddMu) * (DD[i + lag] - ddMu);
        }
        autoCorr = (sum / count) / ddVar;
      }
      vector[rhythmOffset + lag - 1] = autoCorr;
      observed[rhythmOffset + lag - 1] = DD.length > lag + 5;
    }

    // Typing speed variance over sliding windows of size 10
    const windowSize = 10;
    const windowMeans = [];
    for (let i = 0; i <= DD.length - windowSize; i++) {
      let wSum = 0;
      for (let j = 0; j < windowSize; j++) wSum += DD[i + j];
      windowMeans.push(wSum / windowSize);
    }
    vector[rhythmOffset + 5] = windowMeans.length >= 2 ? stdDev(windowMeans) : 0;
    observed[rhythmOffset + 5] = windowMeans.length >= 2;

    // Burst/pause ratio
    const belowMedian = DD.filter(d => d < ddMu).length;
    const aboveDouble = DD.filter(d => d > ddMu * 2).length;
    vector[rhythmOffset + 6] = aboveDouble > 0 ? belowMedian / aboveDouble : belowMedian;
    observed[rhythmOffset + 6] = true;

    // Coefficient of variation
    vector[rhythmOffset + 7] = ddMu > 0 ? ddSd / ddMu : 0;
    observed[rhythmOffset + 7] = true;

    // Burst speed (fastest 25% of DD intervals)
    const ddSorted = DD.slice().sort((a, b) => a - b);
    const q25Idx = Math.floor(ddSorted.length * 0.25);
    const burstDDs = ddSorted.slice(0, Math.max(1, q25Idx));
    vector[rhythmOffset + 8] = mean(burstDDs);
    observed[rhythmOffset + 8] = true;

    // Pause characteristic (slowest 25%)
    const q75Idx = Math.floor(ddSorted.length * 0.75);
    const pauseDDs = ddSorted.slice(q75Idx);
    vector[rhythmOffset + 9] = mean(pauseDDs);
    observed[rhythmOffset + 9] = true;

    // Pause count per 100 keystrokes (DD > 500ms)
    const pauseCount = DD.filter(d => d > 500).length;
    vector[rhythmOffset + 10] = (pauseCount / DD.length) * 100;
    observed[rhythmOffset + 10] = true;

    // Jerk: mean absolute second derivative of DD intervals
    if (DD.length >= 3) {
      let jerkSum = 0;
      for (let i = 1; i < DD.length - 1; i++) {
        jerkSum += Math.abs(DD[i + 1] - 2 * DD[i] + DD[i - 1]);
      }
      vector[rhythmOffset + 11] = jerkSum / (DD.length - 2);
      observed[rhythmOffset + 11] = true;
    }
  }

  // ── Group F: Hand/Finger Transition Features (8 features) ──
  const transOffset = GROUP_OFFSETS.F;
  const transitions = { LR: [], RL: [], sameHand: [], sameFinger: [], sameRow: [], adjRow: [], skipRow: [] };

  for (let i = 1; i < valid.length; i++) {
    const c1 = valid[i - 1].char;
    const c2 = valid[i].char;
    if (!c1 || !c2) continue;

    const k1 = QWERTY_MAP[c1] || QWERTY_MAP[c1.toLowerCase()];
    const k2 = QWERTY_MAP[c2] || QWERTY_MAP[c2.toLowerCase()];
    if (!k1 || !k2) continue;

    const dd = valid[i].timestamp - valid[i - 1].timestamp;
    if (dd < 0 || dd >= 10000) continue;

    // Hand transitions
    if (k1.hand === 'L' && k2.hand === 'R') transitions.LR.push(dd);
    else if (k1.hand === 'R' && k2.hand === 'L') transitions.RL.push(dd);
    else transitions.sameHand.push(dd);

    // Same finger
    if (k1.hand === k2.hand && k1.finger === k2.finger) transitions.sameFinger.push(dd);

    // Row transitions
    const rowDist = Math.abs(k1.row - k2.row);
    if (rowDist === 0) transitions.sameRow.push(dd);
    else if (rowDist === 1) transitions.adjRow.push(dd);
    else transitions.skipRow.push(dd);
  }

  const transKeys = ['LR', 'RL', 'sameHand', 'sameFinger', 'sameRow', 'adjRow', 'skipRow'];
  for (let i = 0; i < transKeys.length; i++) {
    const arr = transitions[transKeys[i]];
    vector[transOffset + i] = arr.length > 0 ? mean(arr) : 0;
    observed[transOffset + i] = arr.length >= 3;
  }

  // Ratio of same-hand to cross-hand transitions
  const crossHand = transitions.LR.length + transitions.RL.length;
  const total = crossHand + transitions.sameHand.length;
  vector[transOffset + 7] = total > 0 ? transitions.sameHand.length / total : 0.5;
  observed[transOffset + 7] = total >= 5;

  // ── Group G: Error Dynamics (5 features) ──
  const errOffset = GROUP_OFFSETS.G;
  const totalChars = valid.length;
  const incorrectIndices = [];
  for (let i = 0; i < valid.length; i++) {
    if (!valid[i].isCorrect) incorrectIndices.push(i);
  }
  const errorCount = incorrectIndices.length;

  // Error rate
  vector[errOffset] = totalChars > 0 ? errorCount / totalChars : 0;
  observed[errOffset] = true;

  // Error clustering: consecutive error runs / total errors
  if (errorCount > 0) {
    let runs = 0;
    for (let i = 0; i < incorrectIndices.length; i++) {
      if (i === 0 || incorrectIndices[i] !== incorrectIndices[i - 1] + 1) runs++;
    }
    vector[errOffset + 1] = runs / errorCount;
    observed[errOffset + 1] = true;
  }

  // Error recovery time: mean DD immediately after an error
  const recoveryTimes = [];
  for (const idx of incorrectIndices) {
    if (idx + 1 < valid.length) {
      const dd = valid[idx + 1].timestamp - valid[idx].timestamp;
      if (dd >= 0 && dd < 10000) recoveryTimes.push(dd);
    }
  }
  vector[errOffset + 2] = recoveryTimes.length > 0 ? mean(recoveryTimes) : 0;
  observed[errOffset + 2] = recoveryTimes.length >= 2;

  // Error dwell vs correct dwell ratio
  const errorDwells = [];
  const correctDwells = [];
  for (const k of valid) {
    if (k.isCorrect) correctDwells.push(k.dwellTime);
    else errorDwells.push(k.dwellTime);
  }
  const correctMean = correctDwells.length > 0 ? mean(correctDwells) : 1;
  vector[errOffset + 3] = errorDwells.length > 0 ? mean(errorDwells) / correctMean : 1;
  observed[errOffset + 3] = errorDwells.length >= 2;

  // Position-normalized error rate: errors in first half vs second half
  const midpoint = Math.floor(totalChars / 2);
  const firstHalfErrors = incorrectIndices.filter(i => i < midpoint).length;
  const secondHalfErrors = incorrectIndices.filter(i => i >= midpoint).length;
  const firstHalfSize = midpoint || 1;
  const secondHalfSize = (totalChars - midpoint) || 1;
  const firstRate = firstHalfErrors / firstHalfSize;
  const secondRate = secondHalfErrors / secondHalfSize;
  vector[errOffset + 4] = secondRate > 0 ? firstRate / secondRate : (firstRate > 0 ? 2 : 1);
  observed[errOffset + 4] = errorCount >= 2;

  // ── Build metadata ──
  const duration = valid.length >= 2
    ? valid[valid.length - 1].timestamp - valid[0].timestamp
    : 0;

  return {
    vector,
    featureNames,
    observed,
    metadata: {
      keystrokeCount: valid.length,
      digraphsCovered,
      trigraphsCovered,
      duration
    }
  };
}

// ── Feature Name Builder ───────────────────────────────────────────

let _featureNamesCache = null;

function buildFeatureNames() {
  if (_featureNamesCache) return _featureNamesCache;

  const names = new Array(FEATURE_COUNT);
  const statNames = ['mean', 'median', 'stdDev', 'IQR', 'skewness', 'kurtosis', 'p10', 'p25', 'p75', 'p90'];

  // Group A: Global timing
  for (const [t, timing] of ['H', 'DD', 'UD'].entries()) {
    for (const [s, stat] of statNames.entries()) {
      names[GROUP_OFFSETS.A + t * 10 + s] = `global_${timing}_${stat}`;
    }
  }

  // Group B: Per-key dwell
  for (const [i, key] of TOP_KEYS.entries()) {
    const keyName = key === ' ' ? 'space' : key;
    names[GROUP_OFFSETS.B + i * 2] = `perkey_${keyName}_mean`;
    names[GROUP_OFFSETS.B + i * 2 + 1] = `perkey_${keyName}_stdDev`;
  }

  // Group C: Digraphs
  for (const [i, dg] of TOP_DIGRAPHS.entries()) {
    names[GROUP_OFFSETS.C + i * 3] = `digraph_${dg}_DD`;
    names[GROUP_OFFSETS.C + i * 3 + 1] = `digraph_${dg}_UD`;
    names[GROUP_OFFSETS.C + i * 3 + 2] = `digraph_${dg}_hold`;
  }

  // Group D: Trigraphs
  for (const [i, tg] of TOP_TRIGRAPHS.entries()) {
    names[GROUP_OFFSETS.D + i] = `trigraph_${tg}_total`;
  }

  // Group E: Rhythm
  const rhythmNames = [
    'rhythm_autocorr_lag1', 'rhythm_autocorr_lag2', 'rhythm_autocorr_lag3',
    'rhythm_autocorr_lag4', 'rhythm_autocorr_lag5',
    'rhythm_speed_variance', 'rhythm_burst_pause_ratio', 'rhythm_CV',
    'rhythm_burst_speed', 'rhythm_pause_speed', 'rhythm_pause_freq',
    'rhythm_jerk'
  ];
  for (const [i, name] of rhythmNames.entries()) {
    names[GROUP_OFFSETS.E + i] = name;
  }

  // Group F: Hand/finger transitions
  const transNames = [
    'trans_LR_mean', 'trans_RL_mean', 'trans_sameHand_mean', 'trans_sameFinger_mean',
    'trans_sameRow_mean', 'trans_adjRow_mean', 'trans_skipRow_mean',
    'trans_sameHand_ratio'
  ];
  for (const [i, name] of transNames.entries()) {
    names[GROUP_OFFSETS.F + i] = name;
  }

  // Group G: Error dynamics
  const errorNames = [
    'error_rate', 'error_clustering', 'error_recovery_time',
    'error_dwell_ratio', 'error_position_ratio'
  ];
  for (const [i, name] of errorNames.entries()) {
    names[GROUP_OFFSETS.G + i] = name;
  }

  _featureNamesCache = names;
  return names;
}

/**
 * Extract a subset of the feature vector based on selected indices.
 * @param {number[]} vector - Full 200D feature vector
 * @param {number[]} selectedIndices - Indices to keep
 * @returns {number[]} Reduced feature vector
 */
function selectSubset(vector, selectedIndices) {
  return selectedIndices.map(i => vector[i]);
}

/**
 * Legacy compatibility wrapper: extract old-format features from keystrokes.
 * Returns the same shape as the old biometricService.extractFeatures().
 * Used during migration period.
 */
function extractLegacyFeatures(keystrokes) {
  const result = extractFeatureVector(keystrokes);
  if (!result) return null;

  const v = result.vector;
  return {
    dwellTime: { mean: v[0], stdDev: v[2], min: 0, max: 0, median: v[1] },
    flightTime: { mean: v[20], stdDev: v[22], min: 0, max: 0, median: v[21] },
    perKeyDwell: {},
    digraphTimings: {},
    errorRate: { overall: v[GROUP_OFFSETS.G] },
    rhythm: {
      burstSpeed: v[GROUP_OFFSETS.E + 8],
      pauseFrequency: v[GROUP_OFFSETS.E + 10],
      pauseDuration: v[GROUP_OFFSETS.E + 9],
      consistency: 1 - v[GROUP_OFFSETS.E + 7] // CV -> consistency
    },
    totalKeystrokes: result.metadata.keystrokeCount
  };
}

module.exports = {
  extractFeatureVector,
  selectSubset,
  extractLegacyFeatures,
  buildFeatureNames,
  FEATURE_COUNT,
  GROUP_OFFSETS,
  TOP_KEYS,
  TOP_DIGRAPHS,
  TOP_TRIGRAPHS,
  // Exported for use by other modules
  mean,
  median,
  stdDev,
  percentile,
  distributionStats
};
