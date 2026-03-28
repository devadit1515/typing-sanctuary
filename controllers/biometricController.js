const KeystrokeBiometrics = require('../models/KeystrokeBiometrics');
const { extractFeatureVector, extractLegacyFeatures } = require('../services/featureEngineering');
const { verifyKeystrokeSample } = require('../services/verificationPipeline');
const adaptiveLearningService = require('../services/adaptiveLearningService');
const deviceFingerprintService = require('../services/deviceFingerprintService');
const dataExportService = require('../services/dataExportService');

/**
 * Submit a keystroke sample for enrollment or verification
 */
exports.submitSample = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { passage, passageLength, deviceInfo, keystrokes } = req.body;

    // Validate input
    if (!keystrokes || !Array.isArray(keystrokes) || keystrokes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid keystroke data'
      });
    }

    // Get or create biometric record
    let biometric = await KeystrokeBiometrics.getOrCreate(req.session.userId);

    // Check if user has opted out
    if (biometric.optOut) {
      return res.status(403).json({
        success: false,
        message: 'User has opted out of biometric authentication'
      });
    }

    // Check if user has given consent
    if (!biometric.consent.given) {
      return res.status(403).json({
        success: false,
        message: 'Biometric consent required',
        requiresConsent: true
      });
    }

    // Check if account is locked
    if (biometric.isLocked()) {
      return res.status(403).json({
        success: false,
        message: 'Account temporarily locked due to suspicious activity',
        lockedUntil: biometric.security.lockedUntil
      });
    }

    // Generate device fingerprint
    const deviceFingerprint = deviceFingerprintService.generateDeviceFingerprint(deviceInfo);

    // Detect keyboard hardware if enough keystrokes
    if (keystrokes.length >= 50) {
      deviceFingerprint.keyboardSignature = deviceFingerprintService.detectKeyboardHardware(keystrokes);
    }

    // Extract features using v2 pipeline
    const featureData = extractFeatureVector(keystrokes);

    if (!featureData) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract features from keystroke data'
      });
    }

    // Also get legacy features for v1 backward compat
    const features = extractLegacyFeatures(keystrokes) || {};

    // Create sample data with device fingerprint
    const sampleData = {
      timestamp: new Date(),
      passage: passage,
      passageLength: passageLength || passage.length,
      deviceInfo: deviceInfo || {},
      deviceFingerprint: deviceFingerprint.fingerprint,
      deviceType: deviceFingerprint.deviceType,
      keyboardSignature: deviceFingerprint.keyboardSignature,
      keystrokes: keystrokes.map(k => ({
        char: k.char,
        keyCode: k.keyCode,
        timestamp: k.timestamp,
        dwellTime: k.dwellTime,
        flightTime: k.flightTime,
        position: k.position,
        isCorrect: k.isCorrect,
        previousChar: k.previousChar
      }))
    };

    // Add sample to biometric record
    await biometric.addSample(sampleData);

    // Update v1 profile for backward compat
    await biometric.updateProfile(features);

    // Build/update v2 profile if we have enough samples
    let verificationResult = null;
    const sampleCount = biometric.samples?.length || 0;

    if (sampleCount >= adaptiveLearningService.MIN_SAMPLES_FOR_PROFILE) {
      try {
        if (biometric.profileVersion !== 2) {
          // First-time v2 profile build
          await adaptiveLearningService.buildProfile(req.session.userId);
        } else {
          // Incremental v2 update
          await adaptiveLearningService.updateProfile(
            req.session.userId,
            { keystrokes },
            true
          );
        }

        // Reload biometric
        biometric = await KeystrokeBiometrics.findOne({ userId: req.session.userId });

        // Verify using v2 pipeline if enrolled
        if (biometric.profileVersion === 2 && biometric.v2Profile?.enrollmentComplete) {
          verificationResult = verifyKeystrokeSample(biometric.v2Profile, keystrokes);

          // Record authentication attempt
          await biometric.recordAuthAttempt({
            success: verificationResult.authenticated,
            anomalyScore: verificationResult.fusedScore,
            method: 'ml_ensemble',
            context: {
              device: deviceInfo?.platform || 'unknown',
              timeOfDay: new Date().getHours(),
              sessionId: req.sessionID
            }
          });
        }
      } catch (learningError) {
        console.error('Error in v2 adaptive learning:', learningError);
      }
    }

    res.json({
      success: true,
      message: 'Keystroke sample submitted successfully',
      enrollmentStatus: biometric.enrollmentStatus,
      enrollmentProgress: {
        samplesCollected: biometric.enrollmentProgress.samplesCollected,
        samplesRequired: biometric.enrollmentProgress.samplesRequired,
        percentage: Math.round(
          (biometric.enrollmentProgress.samplesCollected /
            biometric.enrollmentProgress.samplesRequired) * 100
        )
      },
      verification: verificationResult
    });

  } catch (error) {
    console.error('Error submitting keystroke sample:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing keystroke data'
    });
  }
};

/**
 * Give consent for biometric authentication
 */
exports.giveConsent = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { researchConsent } = req.body;

    let biometric = await KeystrokeBiometrics.getOrCreate(req.session.userId);

    biometric.consent = {
      given: true,
      givenAt: new Date(),
      version: '1.0',
      researchConsent: researchConsent || false
    };

    biometric.optOut = false;

    await biometric.save();

    res.json({
      success: true,
      message: 'Consent recorded successfully'
    });

  } catch (error) {
    console.error('Error recording consent:', error);
    res.status(500).json({
      success: false,
      message: 'Server error recording consent'
    });
  }
};

/**
 * Withdraw consent / opt out of biometric authentication
 */
exports.optOut = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { deleteData } = req.body;

    let biometric = await KeystrokeBiometrics.findOne({ userId: req.session.userId });

    if (!biometric) {
      return res.status(404).json({
        success: false,
        message: 'No biometric data found'
      });
    }

    biometric.optOut = true;
    biometric.optOutDate = new Date();
    biometric.consent.given = false;

    if (deleteData) {
      // Delete all samples and profile data
      biometric.samples = [];
      biometric.profile = {};
      biometric.enrollmentStatus = 'not_started';
      biometric.enrollmentProgress.samplesCollected = 0;
    }

    await biometric.save();

    res.json({
      success: true,
      message: 'Successfully opted out of biometric authentication',
      dataDeleted: deleteData || false
    });

  } catch (error) {
    console.error('Error opting out:', error);
    res.status(500).json({
      success: false,
      message: 'Server error opting out'
    });
  }
};

/**
 * Get user's biometric profile (safe version without raw data)
 */
exports.getProfile = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const biometric = await KeystrokeBiometrics.findOne({ userId: req.session.userId });

    if (!biometric) {
      return res.json({
        success: true,
        enrolled: false,
        message: 'No biometric profile found'
      });
    }

    res.json({
      success: true,
      enrolled: biometric.isEnrolled(),
      profile: biometric.toSafeObject()
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
};

/**
 * Verify a keystroke sample against user's profile
 * Used for continuous authentication during active sessions
 */
exports.verify = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { keystrokes } = req.body;

    if (!keystrokes || !Array.isArray(keystrokes) || keystrokes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid keystroke data'
      });
    }

    const biometric = await KeystrokeBiometrics.findOne({ userId: req.session.userId });

    if (!biometric || !biometric.isEnrolled()) {
      return res.status(403).json({
        success: false,
        message: 'User not enrolled in biometric authentication'
      });
    }

    // Auto-migrate to v2 if needed
    if (biometric.profileVersion !== 2 && biometric.samples?.length >= 10) {
      try {
        await adaptiveLearningService.buildProfile(req.session.userId);
        biometric = await KeystrokeBiometrics.findOne({ userId: req.session.userId });
      } catch (e) {
        console.error('V2 migration failed:', e.message);
      }
    }

    // Verify using v2 pipeline
    let result;
    if (biometric.profileVersion === 2 && biometric.v2Profile?.enrollmentComplete) {
      result = verifyKeystrokeSample(biometric.v2Profile, keystrokes);
    } else {
      result = {
        authenticated: false,
        confidence: 0,
        riskLevel: 'HIGH',
        fusedScore: 0,
        error: 'V2 profile not available'
      };
    }

    // Record authentication attempt
    await biometric.recordAuthAttempt({
      success: result.authenticated,
      anomalyScore: result.fusedScore || 0,
      method: 'ml_ensemble',
      context: {
        device: req.body.deviceInfo?.platform || 'unknown',
        timeOfDay: new Date().getHours(),
        sessionId: req.sessionID
      }
    });

    res.json({
      success: true,
      verification: result
    });

  } catch (error) {
    console.error('Error verifying keystroke sample:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying keystroke sample'
    });
  }
};

/**
 * Get authentication history for current user
 */
exports.getAuthHistory = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const biometric = await KeystrokeBiometrics.findOne({ userId: req.session.userId });

    if (!biometric) {
      return res.json({
        success: true,
        history: []
      });
    }

    // Return last 20 authentication attempts
    const history = biometric.authenticationHistory
      .slice(-20)
      .reverse()
      .map(attempt => ({
        timestamp: attempt.timestamp,
        success: attempt.success,
        anomalyScore: attempt.anomalyScore,
        method: attempt.method,
        context: attempt.context
      }));

    res.json({
      success: true,
      history: history
    });

  } catch (error) {
    console.error('Error fetching auth history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching authentication history'
    });
  }
};

/**
 * Delete all biometric data for current user
 */
exports.deleteData = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await KeystrokeBiometrics.deleteOne({ userId: req.session.userId });

    res.json({
      success: true,
      message: 'All biometric data deleted successfully',
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error deleting biometric data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting data'
    });
  }
};

/**
 * Get enrollment statistics (admin only - would need admin middleware)
 */
exports.getEnrollmentStats = async (req, res) => {
  try {
    // TODO: Add admin authentication check
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const stats = await KeystrokeBiometrics.getEnrollmentStats();

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Error fetching enrollment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching statistics'
    });
  }
};

/**
 * Get adaptive learning statistics for current user
 */
exports.getAdaptiveLearningStats = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const stats = await adaptiveLearningService.getLearningStats(req.session.userId);

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Error fetching adaptive learning stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching learning statistics'
    });
  }
};

/**
 * Rollback biometric profile to previous version
 */
exports.rollbackProfile = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { version } = req.body;

    const result = await adaptiveLearningService.rollbackProfile(
      req.session.userId,
      version || null
    );

    res.json({
      success: true,
      message: 'Profile rolled back successfully',
      result: result
    });

  } catch (error) {
    console.error('Error rolling back profile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error rolling back profile'
    });
  }
};

/**
 * Export user's biometric data as CSV
 */
exports.exportDataCSV = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const options = {
      includeRawKeystrokes: req.query.includeRaw === 'true',
      anonymize: req.query.anonymize === 'true'
    };

    const csvData = await dataExportService.exportAsCSV(req.session.userId, options);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="biometric-data.csv"');
    res.send(csvData);

  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error exporting data'
    });
  }
};

/**
 * Export user's biometric data as JSON
 */
exports.exportDataJSON = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const options = {
      includeRawKeystrokes: req.query.includeRaw !== 'false',
      includeAuthHistory: req.query.includeHistory !== 'false',
      anonymize: req.query.anonymize === 'true'
    };

    const jsonData = await dataExportService.exportAsJSON(req.session.userId, options);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="biometric-data.json"');
    res.json(jsonData);

  } catch (error) {
    console.error('Error exporting JSON:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error exporting data'
    });
  }
};

/**
 * Generate anonymized research dataset (admin only)
 */
exports.generateResearchDataset = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // TODO: Add admin authorization check

    const options = {
      ethicsApprovalNumber: req.body.ethicsApprovalNumber
    };

    const dataset = await dataExportService.generateResearchDataset(null, options);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="research-dataset.json"');
    res.json(dataset);

  } catch (error) {
    console.error('Error generating research dataset:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error generating dataset'
    });
  }
};
