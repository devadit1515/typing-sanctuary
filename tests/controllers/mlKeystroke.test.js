const fs = require('fs');
const path = require('path');

// Mock the ML client + the Mongoose model so we can unit-test the controller's
// decision logic and fail-safe contract without a DB or a live ML service.
jest.mock('../../services/mlServiceClient');
jest.mock('../../models/MlKeystrokeProfile');

const mlServiceClient = require('../../services/mlServiceClient');
const MlKeystrokeProfile = require('../../models/MlKeystrokeProfile');
const ctrl = require('../../controllers/mlKeystrokeController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

// A stored, enrolled profile doc with a no-op save + decisions array.
function enrolledDoc() {
  return {
    consentGiven: true,
    modelVersion: 'cmu-v1',
    profile: { centroid: [0, 0], covInverse: null, refs: [[0, 0]], threshold: 0.5 },
    decisions: [],
    isEnrolled: () => true,
    save: jest.fn().mockResolvedValue(true),
  };
}

describe('mlKeystrokeController — fail-safe verification contract', () => {
  afterEach(() => jest.clearAllMocks());

  test('LOW risk from the service -> ACCEPT', async () => {
    MlKeystrokeProfile.findOne.mockResolvedValue(enrolledDoc());
    mlServiceClient.embed.mockResolvedValue({ embedding: [0.1, 0.1] });
    mlServiceClient.verify.mockResolvedValue({
      score: 0.1, confidence: 95, riskLevel: 'LOW', perComponent: {} });

    const res = mockRes();
    await ctrl.verify({ userId: 'u1', body: { window: [{}], source: 'login' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.decision).toBe('ACCEPT');
    expect(res.body.action).toBe('accept');
  });

  test('HIGH risk -> CHALLENGE, never a silent pass', async () => {
    MlKeystrokeProfile.findOne.mockResolvedValue(enrolledDoc());
    mlServiceClient.embed.mockResolvedValue({ embedding: [9, 9] });
    mlServiceClient.verify.mockResolvedValue({
      score: 9, confidence: 10, riskLevel: 'HIGH', perComponent: {} });

    const res = mockRes();
    await ctrl.verify({ userId: 'u1', body: { window: [{}] } }, res);
    expect(res.body.decision).toBe('CHALLENGE');
    expect(res.body.action).toBe('challenge');
  });

  test('ML service outage -> INDETERMINATE + fallback factor (never fail-open)', async () => {
    MlKeystrokeProfile.findOne.mockResolvedValue(enrolledDoc());
    mlServiceClient.embed.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = mockRes();
    await ctrl.verify({ userId: 'u1', body: { window: [{}] } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.decision).toBe('INDETERMINATE');
    expect(res.body.action).toBe('fallback_factor');
  });

  test('model-version mismatch -> INDETERMINATE + reenroll (never score across versions)', async () => {
    const doc = enrolledDoc();
    MlKeystrokeProfile.findOne.mockResolvedValue(doc);

    const res = mockRes();
    await ctrl.verify({ userId: 'u1',
      body: { window: [{}], modelVersion: 'freetext-v2' } }, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.decision).toBe('INDETERMINATE');
    expect(res.body.action).toBe('reenroll');
    // Crucially, we must NOT have called the embedding service at all.
    expect(mlServiceClient.embed).not.toHaveBeenCalled();
  });

  test('not enrolled -> 409, no scoring attempted', async () => {
    MlKeystrokeProfile.findOne.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.verify({ userId: 'u1', body: { window: [{}] } }, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('not_enrolled');
  });
});

describe('mlKeystrokeController — stays standalone (no legacy entanglement)', () => {
  test('does not import the legacy v2 biometric stack', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../controllers/mlKeystrokeController.js'), 'utf8');
    // Check actual require() imports, not comments (which legitimately NAME the
    // legacy modules to document that this slice deliberately avoids them).
    const requires = (src.match(/require\(['"][^'"]+['"]\)/g) || []).join('\n');
    expect(requires).not.toMatch(/verificationPipeline/);
    expect(requires).not.toMatch(/adaptiveLearningService/);
    expect(requires).not.toMatch(/featureEngineering/);
    // It reads req.userId (JWT), never req.session.userId.
    expect(src).not.toMatch(/req\.session\.userId/);
    expect(src).toMatch(/req\.userId/);
  });
});
