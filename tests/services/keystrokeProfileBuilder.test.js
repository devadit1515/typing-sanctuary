const {
  buildProfileFromEmbeddings,
  calibrateThreshold,
  centroidOf,
} = require('../../services/keystrokeProfileBuilder');

// Small helper: a 128-D vector near a base value with a little per-dim jitter.
function vec(base, jitter = 0) {
  return Array.from({ length: 128 }, (_, i) =>
    base + (jitter ? jitter * Math.sin(i + base) : 0));
}

describe('keystrokeProfileBuilder', () => {
  test('builds a verify-ready Profile of the right shape', () => {
    const embeddings = [vec(0.1, 0.01), vec(0.1, 0.012), vec(0.1, 0.009),
                        vec(0.1, 0.011), vec(0.1, 0.010)];
    const p = buildProfileFromEmbeddings(embeddings);

    expect(p.centroid).toHaveLength(128);
    expect(Array.isArray(p.refs)).toBe(true);
    expect(p.refs).toHaveLength(5);
    expect(p.refs[0]).toHaveLength(128);
    expect(typeof p.threshold).toBe('number');
    expect(p.threshold).toBeGreaterThan(0);
    // >=2 samples -> a 128x128 covInverse is produced (not the null fallback).
    expect(p.covInverse).not.toBeNull();
    expect(p.covInverse).toHaveLength(128);
    expect(p.covInverse[0]).toHaveLength(128);
  });

  test('centroid is the mean of the embeddings', () => {
    const c = centroidOf([vec(0.2), vec(0.4)]);
    expect(c[0]).toBeCloseTo(0.3, 9);
  });

  test('single window: covInverse falls back to null (verify uses Manhattan)', () => {
    const p = buildProfileFromEmbeddings([vec(0.3)]);
    expect(p.covInverse).toBeNull();
    expect(p.refs).toHaveLength(1);
    expect(p.threshold).toBeGreaterThan(0);
  });

  test('tighter (more consistent) enrollment -> smaller threshold', () => {
    const tight = [vec(0.1, 0.001), vec(0.1, 0.0011), vec(0.1, 0.0009),
                   vec(0.1, 0.0012)];
    const loose = [vec(0.1, 0.05), vec(0.1, 0.06), vec(0.1, 0.04),
                   vec(0.1, 0.055)];
    expect(calibrateThreshold(tight)).toBeLessThan(calibrateThreshold(loose));
  });

  test('rejects empty input rather than building a hollow profile', () => {
    expect(() => buildProfileFromEmbeddings([])).toThrow(/need >=1/i);
  });
});
