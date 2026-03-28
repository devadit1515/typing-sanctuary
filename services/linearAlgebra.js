/**
 * Linear Algebra Utilities
 * Pure JavaScript matrix operations — replaces mathjs dependency.
 * All matrices are 2D arrays (number[][]), vectors are 1D arrays (number[]).
 */

// ── Vector Operations ──────────────────────────────────────────────

function vecSubtract(a, b) {
  const n = a.length;
  const result = new Array(n);
  for (let i = 0; i < n; i++) result[i] = a[i] - b[i];
  return result;
}

function vecAdd(a, b) {
  const n = a.length;
  const result = new Array(n);
  for (let i = 0; i < n; i++) result[i] = a[i] + b[i];
  return result;
}

function vecDot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function vecScale(v, s) {
  const n = v.length;
  const result = new Array(n);
  for (let i = 0; i < n; i++) result[i] = v[i] * s;
  return result;
}

function vecNorm(v) {
  return Math.sqrt(vecDot(v, v));
}

// ── Matrix Operations ──────────────────────────────────────────────

function matCreate(rows, cols, fill = 0) {
  const m = new Array(rows);
  for (let i = 0; i < rows; i++) {
    m[i] = new Array(cols);
    for (let j = 0; j < cols; j++) m[i][j] = fill;
  }
  return m;
}

function matTranspose(A) {
  const rows = A.length;
  const cols = A[0].length;
  const T = matCreate(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) T[j][i] = A[i][j];
  }
  return T;
}

function matMul(A, B) {
  const aRows = A.length;
  const aCols = A[0].length;
  const bCols = B[0].length;
  const C = matCreate(aRows, bCols);
  for (let i = 0; i < aRows; i++) {
    for (let k = 0; k < aCols; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < bCols; j++) {
        C[i][j] += aik * B[k][j];
      }
    }
  }
  return C;
}

/** Multiply matrix A by column vector v, return vector */
function matVecMul(A, v) {
  const n = A.length;
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < v.length; j++) sum += A[i][j] * v[j];
    result[i] = sum;
  }
  return result;
}

function matDiag(vec) {
  const n = vec.length;
  const D = matCreate(n, n);
  for (let i = 0; i < n; i++) D[i][i] = vec[i];
  return D;
}

function matIdentity(n) {
  const I = matCreate(n, n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

function matTrace(A) {
  let sum = 0;
  for (let i = 0; i < A.length; i++) sum += A[i][i];
  return sum;
}

function matScale(A, s) {
  const rows = A.length;
  const cols = A[0].length;
  const R = matCreate(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) R[i][j] = A[i][j] * s;
  }
  return R;
}

function matAdd(A, B) {
  const rows = A.length;
  const cols = A[0].length;
  const R = matCreate(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) R[i][j] = A[i][j] + B[i][j];
  }
  return R;
}

/**
 * Matrix inverse via Gauss-Jordan elimination with partial pivoting.
 * Returns null if the matrix is singular.
 */
function matInverse(A) {
  const n = A.length;
  // Augmented matrix [A | I]
  const aug = matCreate(n, 2 * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) aug[i][j] = A[i][j];
    aug[i][n + i] = 1;
  }

  for (let col = 0; col < n; col++) {
    // Partial pivoting — find row with largest absolute value in this column
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col]);
      if (val > maxVal) { maxVal = val; maxRow = row; }
    }
    if (maxVal < 1e-12) return null; // Singular

    // Swap rows
    if (maxRow !== col) {
      const tmp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = tmp;
    }

    // Scale pivot row
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    // Eliminate other rows
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverse from augmented matrix
  const inv = matCreate(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) inv[i][j] = aug[i][n + j];
  }
  return inv;
}

// ── Covariance Estimation ──────────────────────────────────────────

/**
 * Compute the sample covariance matrix from a set of feature vectors.
 * @param {number[][]} samples - Array of feature vectors (each same length)
 * @returns {{ cov: number[][], mean: number[] }}
 */
function sampleCovariance(samples) {
  const n = samples.length;
  const p = samples[0].length;

  // Compute mean
  const mean = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) mean[j] += samples[i][j];
  }
  for (let j = 0; j < p; j++) mean[j] /= n;

  // Compute covariance (unbiased, n-1 denominator)
  const cov = matCreate(p, p);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      const da = samples[i][a] - mean[a];
      for (let b = a; b < p; b++) {
        const db = samples[i][b] - mean[b];
        cov[a][b] += da * db;
      }
    }
  }
  const denom = n > 1 ? n - 1 : 1;
  for (let a = 0; a < p; a++) {
    for (let b = a; b < p; b++) {
      cov[a][b] /= denom;
      cov[b][a] = cov[a][b]; // Symmetric
    }
  }

  return { cov, mean };
}

/**
 * Ledoit-Wolf shrinkage estimator for the covariance matrix.
 * Shrinks the sample covariance toward a scaled identity matrix:
 *   Σ_shrunk = (1 - α) * S + α * (trace(S)/p) * I
 *
 * This produces a well-conditioned, always-invertible covariance matrix
 * even when n (samples) is close to or smaller than p (features).
 *
 * Based on: Ledoit & Wolf (2004), "A well-conditioned estimator for
 * large-dimensional covariance matrices."
 *
 * @param {number[][]} samples - Array of feature vectors
 * @returns {{ shrunkCov: number[][], inverse: number[]|null, mean: number[], alpha: number }}
 */
function ledoitWolfShrinkage(samples) {
  const n = samples.length;
  const p = samples[0].length;
  const { cov: S, mean } = sampleCovariance(samples);

  // Target: scaled identity μI where μ = trace(S)/p
  const mu = matTrace(S) / p;

  // Compute optimal shrinkage intensity α using Ledoit-Wolf formula
  // α = min(1, (sum of squared Frobenius norms of deviation) / ...)

  // Compute centered data matrix
  const X = new Array(n);
  for (let i = 0; i < n; i++) {
    X[i] = new Array(p);
    for (let j = 0; j < p; j++) X[i][j] = samples[i][j] - mean[j];
  }

  // Compute sum_i ||x_i x_i^T - S||_F^2 (the "pi" term)
  // This measures how variable the sample covariance entries are
  let piSum = 0;
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      for (let b = a; b < p; b++) {
        const xixj = X[i][a] * X[i][b];
        const diff = xixj - S[a][b];
        const contrib = diff * diff;
        piSum += (a === b) ? contrib : 2 * contrib; // Symmetric
      }
    }
  }
  piSum /= (n * n);

  // Compute ||S - μI||_F^2 (the "gamma" term)
  let gammaSum = 0;
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      const target = (a === b) ? mu : 0;
      const diff = S[a][b] - target;
      gammaSum += diff * diff;
    }
  }

  // Optimal shrinkage intensity
  let alpha = gammaSum > 0 ? Math.min(1, piSum / gammaSum) : 1;
  alpha = Math.max(0, alpha);

  // Shrunk covariance: (1 - α) * S + α * μ * I
  const shrunkCov = matCreate(p, p);
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      shrunkCov[a][b] = (1 - alpha) * S[a][b];
    }
    shrunkCov[a][a] += alpha * mu;
  }

  // Pre-compute inverse (Ledoit-Wolf guarantees well-conditioned matrix)
  const inverse = matInverse(shrunkCov);

  return { shrunkCov, inverse, mean, alpha };
}

/**
 * Compute Mahalanobis distance: sqrt((x - μ)^T Σ^{-1} (x - μ))
 * @param {number[]} x - Test vector
 * @param {number[]} mean - Profile mean vector
 * @param {number[][]} covInverse - Inverse covariance matrix
 * @returns {number} Mahalanobis distance
 */
function mahalanobisDistance(x, mean, covInverse) {
  const diff = vecSubtract(x, mean);
  const intermediate = matVecMul(covInverse, diff);
  const d2 = vecDot(diff, intermediate);
  return Math.sqrt(Math.max(0, d2));
}

module.exports = {
  // Vector ops
  vecSubtract,
  vecAdd,
  vecDot,
  vecScale,
  vecNorm,
  // Matrix ops
  matCreate,
  matTranspose,
  matMul,
  matVecMul,
  matDiag,
  matIdentity,
  matTrace,
  matScale,
  matAdd,
  matInverse,
  // Covariance
  sampleCovariance,
  ledoitWolfShrinkage,
  mahalanobisDistance
};
