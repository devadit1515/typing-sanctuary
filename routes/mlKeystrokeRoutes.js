/**
 * Routes for the standalone DEEP keystroke-biometric slice (CREST research
 * model). Namespace: /api/ml-keystroke/*. Kept entirely separate from the legacy
 * /api/keystroke-auth and /api/biometric routes so the two systems don't entangle.
 *
 *   GET  /api/ml-keystroke/status   enrollment + consent state
 *   POST /api/ml-keystroke/consent  { consent: boolean }
 *   POST /api/ml-keystroke/enroll   { windows: [[ks,...],...], modelVersion }
 *   POST /api/ml-keystroke/verify   { window: [ks,...], modelVersion, source }
 */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mlKeystrokeController');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/status', ctrl.getStatus);
router.post('/consent', ctrl.setConsent);
router.post('/enroll', ctrl.enroll);
router.post('/verify', ctrl.verify);

module.exports = router;
