/**
 * Biometric Service
 * Handles feature extraction and analysis of keystroke dynamics data
 */

/**
 * Extract statistical features from keystroke data
 * @param {Array} keystrokes - Array of keystroke objects
 * @returns {Object} Extracted features
 */
function extractFeatures(keystrokes) {
  if (!keystrokes || keystrokes.length === 0) {
    return null;
  }

  // Filter out invalid keystrokes
  const validKeystrokes = keystrokes.filter(k =>
    k.dwellTime !== null && k.dwellTime >= 0 && k.dwellTime < 5000
  );

  if (validKeystrokes.length === 0) {
    return null;
  }

  // Extract dwell times
  const dwellTimes = validKeystrokes.map(k => k.dwellTime).filter(d => d !== null);

  // Extract flight times
  const flightTimes = validKeystrokes
    .map(k => k.flightTime)
    .filter(f => f !== null && f >= 0 && f < 10000);

  // Calculate basic statistics
  const dwellStats = calculateStats(dwellTimes);
  const flightStats = calculateStats(flightTimes);

  // Extract per-key dwell times
  const perKeyDwell = extractPerKeyDwell(validKeystrokes);

  // Extract digraph timings (two-key combinations)
  const digraphTimings = extractDigraphTimings(validKeystrokes);

  // Calculate error rate
  const totalChars = validKeystrokes.length;
  const incorrectChars = validKeystrokes.filter(k => !k.isCorrect).length;
  const errorRate = totalChars > 0 ? incorrectChars / totalChars : 0;

  // Analyze typing rhythm
  const rhythm = analyzeRhythm(validKeystrokes);

  return {
    dwellTime: dwellStats,
    flightTime: flightStats,
    perKeyDwell: perKeyDwell,
    digraphTimings: digraphTimings,
    errorRate: {
      overall: errorRate,
      byPosition: [] // Can be enhanced later
    },
    rhythm: rhythm,
    totalKeystrokes: validKeystrokes.length
  };
}

/**
 * Calculate statistical measures for an array of values
 */
function calculateStats(values) {
  if (!values || values.length === 0) {
    return {
      mean: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      median: 0
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  const variance = values.reduce((sum, val) => {
    return sum + Math.pow(val - mean, 2);
  }, 0) / values.length;

  const stdDev = Math.sqrt(variance);

  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  return {
    mean: parseFloat(mean.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: parseFloat(median.toFixed(2))
  };
}

/**
 * Extract per-key dwell time statistics
 */
function extractPerKeyDwell(keystrokes) {
  const keyMap = {};

  keystrokes.forEach(k => {
    if (!k.char || k.dwellTime === null) return;

    const char = k.char.toLowerCase();
    if (!keyMap[char]) {
      keyMap[char] = [];
    }
    keyMap[char].push(k.dwellTime);
  });

  const perKeyStats = {};
  Object.keys(keyMap).forEach(char => {
    const values = keyMap[char];
    if (values.length >= 2) { // Only include keys pressed at least twice
      const stats = calculateStats(values);
      perKeyStats[char] = {
        mean: stats.mean,
        stdDev: stats.stdDev,
        count: values.length
      };
    }
  });

  return perKeyStats;
}

/**
 * Extract digraph (two-key combination) timings
 */
function extractDigraphTimings(keystrokes) {
  const digraphMap = {};

  for (let i = 1; i < keystrokes.length; i++) {
    const current = keystrokes[i];
    const previous = keystrokes[i - 1];

    if (!previous.char || !current.char || current.flightTime === null) {
      continue;
    }

    const digraph = (previous.char + current.char).toLowerCase();

    if (!digraphMap[digraph]) {
      digraphMap[digraph] = [];
    }

    // Use flight time as the digraph timing
    digraphMap[digraph].push(current.flightTime);
  }

  const digraphStats = {};
  Object.keys(digraphMap).forEach(digraph => {
    const values = digraphMap[digraph];
    if (values.length >= 2) { // Only include digraphs that appear at least twice
      const stats = calculateStats(values);
      digraphStats[digraph] = {
        mean: stats.mean,
        stdDev: stats.stdDev,
        count: values.length
      };
    }
  });

  return digraphStats;
}

/**
 * Extract trigraph timings (three-key combinations)
 * NEW: For advanced ML analysis
 */
function extractTrigraphTimings(keystrokes) {
  const trigraphMap = {};

  for (let i = 2; i < keystrokes.length; i++) {
    const k1 = keystrokes[i - 2];
    const k2 = keystrokes[i - 1];
    const k3 = keystrokes[i];

    if (!k1.char || !k2.char || !k3.char) {
      continue;
    }

    const trigraph = (k1.char + k2.char + k3.char).toLowerCase();

    if (!trigraphMap[trigraph]) {
      trigraphMap[trigraph] = [];
    }

    // Calculate total timing for the trigraph sequence
    const timing = (k2.flightTime || 0) + (k2.dwellTime || 0) + (k3.flightTime || 0);

    if (timing > 0 && timing < 5000) { // Sanity check
      trigraphMap[trigraph].push(timing);
    }
  }

  const trigraphStats = {};
  Object.keys(trigraphMap).forEach(trigraph => {
    const values = trigraphMap[trigraph];
    if (values.length >= 2) { // Only include trigraphs that appear at least twice
      const stats = calculateStats(values);
      trigraphStats[trigraph] = {
        mean: stats.mean,
        stdDev: stats.stdDev,
        count: values.length
      };
    }
  });

  return trigraphStats;
}

/**
 * Analyze typing rhythm patterns
 */
function analyzeRhythm(keystrokes) {
  if (keystrokes.length < 10) {
    return {
      burstSpeed: 0,
      pauseFrequency: 0,
      pauseDuration: 0
    };
  }

  const flightTimes = keystrokes
    .map(k => k.flightTime)
    .filter(f => f !== null && f >= 0);

  if (flightTimes.length === 0) {
    return {
      burstSpeed: 0,
      pauseFrequency: 0,
      pauseDuration: 0
    };
  }

  // Define a pause as flight time > 500ms
  const pauseThreshold = 500;
  const pauses = flightTimes.filter(f => f > pauseThreshold);
  const bursts = flightTimes.filter(f => f <= pauseThreshold);

  const burstSpeed = bursts.length > 0
    ? bursts.reduce((a, b) => a + b, 0) / bursts.length
    : 0;

  const pauseFrequency = (pauses.length / keystrokes.length) * 100; // pauses per 100 chars

  const pauseDuration = pauses.length > 0
    ? pauses.reduce((a, b) => a + b, 0) / pauses.length
    : 0;

  // Calculate rhythm consistency (variance-based)
  const burstStats = calculateStats(bursts);
  const consistency = bursts.length > 1
    ? 1 - (burstStats.stdDev / (burstStats.mean + 1))
    : 0;

  return {
    burstSpeed: parseFloat(burstSpeed.toFixed(2)),
    pauseFrequency: parseFloat(pauseFrequency.toFixed(2)),
    pauseDuration: parseFloat(pauseDuration.toFixed(2)),
    consistency: parseFloat(Math.max(0, Math.min(1, consistency)).toFixed(3))
  };
}

/**
 * Update user's biometric profile with new sample
 * Uses exponential weighted moving average to give more weight to recent samples
 */
function updateProfile(existingProfile, newFeatures, alpha = 0.3) {
  if (!existingProfile || !existingProfile.dwellTime) {
    // First sample, just use the new features
    return newFeatures;
  }

  // Exponential weighted moving average: new = alpha * new + (1 - alpha) * old
  const updated = {
    dwellTime: mergeStats(existingProfile.dwellTime, newFeatures.dwellTime, alpha),
    flightTime: mergeStats(existingProfile.flightTime, newFeatures.flightTime, alpha),
    perKeyDwell: mergeMapStats(existingProfile.perKeyDwell, newFeatures.perKeyDwell, alpha),
    digraphTimings: mergeMapStats(existingProfile.digraphTimings, newFeatures.digraphTimings, alpha),
    errorRate: {
      overall: alpha * newFeatures.errorRate.overall + (1 - alpha) * (existingProfile.errorRate?.overall || 0),
      byPosition: [] // Can be enhanced later
    },
    rhythm: {
      burstSpeed: alpha * newFeatures.rhythm.burstSpeed + (1 - alpha) * (existingProfile.rhythm?.burstSpeed || 0),
      pauseFrequency: alpha * newFeatures.rhythm.pauseFrequency + (1 - alpha) * (existingProfile.rhythm?.pauseFrequency || 0),
      pauseDuration: alpha * newFeatures.rhythm.pauseDuration + (1 - alpha) * (existingProfile.rhythm?.pauseDuration || 0)
    }
  };

  return updated;
}

/**
 * Merge two stat objects using weighted average
 */
function mergeStats(oldStats, newStats, alpha) {
  if (!oldStats) return newStats;
  if (!newStats) return oldStats;

  return {
    mean: alpha * newStats.mean + (1 - alpha) * oldStats.mean,
    stdDev: Math.sqrt(
      alpha * Math.pow(newStats.stdDev, 2) + (1 - alpha) * Math.pow(oldStats.stdDev, 2)
    ),
    min: Math.min(oldStats.min, newStats.min),
    max: Math.max(oldStats.max, newStats.max),
    median: alpha * newStats.median + (1 - alpha) * oldStats.median
  };
}

/**
 * Merge map-based statistics (per-key or digraph)
 */
function mergeMapStats(oldMap, newMap, alpha) {
  if (!oldMap) return newMap;
  if (!newMap) return oldMap;

  const merged = { ...oldMap };

  Object.keys(newMap).forEach(key => {
    if (merged[key]) {
      // Key exists in both, merge
      merged[key] = {
        mean: alpha * newMap[key].mean + (1 - alpha) * merged[key].mean,
        stdDev: Math.sqrt(
          alpha * Math.pow(newMap[key].stdDev, 2) + (1 - alpha) * Math.pow(merged[key].stdDev, 2)
        ),
        count: merged[key].count + newMap[key].count
      };
    } else {
      // New key, just add it
      merged[key] = newMap[key];
    }
  });

  return merged;
}

/**
 * Calculate WPM and accuracy from keystroke data
 */
function calculateTypingMetrics(keystrokes, totalTime) {
  if (!keystrokes || keystrokes.length === 0) {
    return { wpm: 0, accuracy: 100 };
  }

  const totalChars = keystrokes.length;
  const correctChars = keystrokes.filter(k => k.isCorrect).length;
  const accuracy = (correctChars / totalChars) * 100;

  // WPM calculation: (chars / 5) / (time in minutes)
  const timeInMinutes = totalTime / 60000; // Convert ms to minutes
  const wpm = timeInMinutes > 0 ? (totalChars / 5) / timeInMinutes : 0;

  return {
    wpm: parseFloat(wpm.toFixed(2)),
    accuracy: parseFloat(accuracy.toFixed(2))
  };
}

module.exports = {
  extractFeatures,
  extractTrigraphTimings,
  updateProfile,
  calculateTypingMetrics,
  calculateStats
};
