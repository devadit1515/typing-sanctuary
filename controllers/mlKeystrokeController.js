/**
 * Standalone controller for the DEEP keystroke-biometric slice (the CREST
 * research model). Vertical flow: consent -> enroll -> typing-login step-up.
 *
 * Talks ONLY to the Python inference service (via services/mlServiceClient) and
 * the standalone MlKeystrokeProfile model. Does NOT touch the legacy v2 stack
 * (verificationPipeline / adaptiveLearningService / User.keystrokeProfile).
 *
 * Fail-safe contract (design spec §6.4): if the ML service is unreachable or a
 * model-version mismatch is detected, verification is INDETERMINATE and the
 * caller must require a fallback factor — NEVER silently pass (never fail-open).
 */
const mlServiceClient = require('../services/mlServiceClient');
const profileBuilder = require('../services/keystrokeProfileBuilder');
const MlKeystrokeProfile = require('../models/MlKeystrokeProfile');

const MIN_ENROLL_WINDOWS = 5;       // enough for a Ledoit-Wolf covariance + LOO

async function _getOrCreate(userId) {
  let doc = await MlKeystrokeProfile.findOne({ user: userId });
  if (!doc) doc = new MlKeystrokeProfile({ user: userId });
  return doc;
}

/** GET /api/ml-keystroke/status — consent + enrollment state for the UI. */
async function getStatus(req, res) {
  try {
    const doc = await MlKeystrokeProfile.findOne({ user: req.userId });
    const enabled = mlServiceClient.isEnabled();
    if (!doc) {
      return res.json({ serviceEnabled: enabled, consentGiven: false,
        enrolled: false, enrolledWindows: 0, modelVersion: null });
    }
    return res.json({
      serviceEnabled: enabled,
      consentGiven: doc.consentGiven,
      enrolled: doc.isEnrolled(),
      enrolledWindows: doc.enrolledWindows,
      modelVersion: doc.modelVersion,
    });
  } catch (err) {
    return res.status(500).json({ error: 'status_failed', detail: err.message });
  }
}

/** POST /api/ml-keystroke/consent { consent: boolean } — opt-in/opt-out. */
async function setConsent(req, res) {
  try {
    const consent = req.body && req.body.consent === true;
    const doc = await _getOrCreate(req.userId);
    doc.consentGiven = consent;
    doc.consentAt = consent ? new Date() : null;
    if (!consent) {
      // Opt-out wipes the profile (design spec §6.5: opt-out erases samples).
      doc.profile = undefined;
      doc.modelVersion = null;
      doc.enrolledWindows = 0;
      doc.enrolledAt = null;
    }
    await doc.save();
    return res.json({ consentGiven: doc.consentGiven });
  } catch (err) {
    return res.status(500).json({ error: 'consent_failed', detail: err.message });
  }
}

/**
 * POST /api/ml-keystroke/enroll { windows: [[keystroke,...],...], modelVersion }
 * Embeds the windows, builds the verify-ready profile, stores it. Consent-gated.
 */
async function enroll(req, res) {
  try {
    const doc = await _getOrCreate(req.userId);
    if (!doc.consentGiven) {
      return res.status(403).json({ error: 'consent_required' });
    }
    const windows = (req.body && req.body.windows) || [];
    if (windows.length < MIN_ENROLL_WINDOWS) {
      return res.status(400).json({ error: 'insufficient_windows',
        need: MIN_ENROLL_WINDOWS, got: windows.length });
    }
    const modelVersion = (req.body && req.body.modelVersion) || 'cmu-v1';
    // Fail-safe: an ML outage here means "enrollment failed", surfaced as 503,
    // not a hollow profile written to the DB.
    const { profile, modelVersion: builtVersion } =
      await profileBuilder.buildProfileFromWindows(windows, modelVersion);

    doc.profile = profile;
    doc.modelVersion = builtVersion;
    doc.enrolledWindows = windows.length;
    doc.enrolledAt = new Date();
    await doc.save();
    return res.json({ enrolled: true, enrolledWindows: windows.length,
      modelVersion: builtVersion, threshold: profile.threshold });
  } catch (err) {
    return res.status(503).json({ error: 'enroll_failed', detail: err.message });
  }
}

/**
 * POST /api/ml-keystroke/verify { window: [keystroke,...], modelVersion, source }
 * Embeds one window, scores it against the stored profile via the service's
 * /verify, returns { decision, confidence, riskLevel }. Fail-safe + version-safe.
 */
async function verify(req, res) {
  let doc;
  try {
    doc = await MlKeystrokeProfile.findOne({ user: req.userId });
  } catch (err) {
    return res.status(500).json({ error: 'lookup_failed', detail: err.message });
  }
  if (!doc || !doc.consentGiven || !doc.isEnrolled()) {
    return res.status(409).json({ error: 'not_enrolled' });
  }

  const window = (req.body && req.body.window) || [];
  const reqVersion = (req.body && req.body.modelVersion) || doc.modelVersion;
  const source = (req.body && req.body.source) || 'login';

  // Version mismatch -> never score across versions; require re-enrollment.
  if (reqVersion && doc.modelVersion && reqVersion !== doc.modelVersion) {
    await _audit(doc, { source, riskLevel: 'INDETERMINATE',
      modelVersion: reqVersion });
    return res.status(409).json({ decision: 'INDETERMINATE',
      reason: 'version_mismatch', riskLevel: 'INDETERMINATE',
      action: 'reenroll' });
  }

  try {
    const emb = await mlServiceClient.embed(window, doc.modelVersion);
    const result = await mlServiceClient.verify(
      emb.embedding, doc.profile, doc.modelVersion);
    await _audit(doc, { source, score: result.score,
      confidence: result.confidence, riskLevel: result.riskLevel,
      modelVersion: doc.modelVersion });

    // Translate risk -> an assistive action (never a bare ACCESS DENIED).
    const action = result.riskLevel === 'LOW' ? 'accept'
      : result.riskLevel === 'MEDIUM' ? 'step_up'
      : 'challenge';
    return res.json({
      decision: result.riskLevel === 'LOW' ? 'ACCEPT' : 'CHALLENGE',
      confidence: result.confidence,
      riskLevel: result.riskLevel,
      perComponent: result.perComponent,
      action,
    });
  } catch (err) {
    // Fail-safe: ML outage -> INDETERMINATE, require a fallback factor.
    await _audit(doc, { source, riskLevel: 'INDETERMINATE',
      modelVersion: doc.modelVersion });
    return res.status(503).json({ decision: 'INDETERMINATE',
      reason: 'service_unavailable', riskLevel: 'INDETERMINATE',
      action: 'fallback_factor', detail: err.message });
  }
}

async function _audit(doc, entry) {
  try {
    doc.decisions.push(entry);
    await doc.save();
  } catch (_e) {
    // Audit logging must never block the decision path; swallow persistence
    // errors here (the decision has already been computed and returned).
  }
}

module.exports = { getStatus, setConsent, enroll, verify };
