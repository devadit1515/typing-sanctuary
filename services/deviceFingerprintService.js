/**
 * Device Fingerprinting Service
 *
 * Generates unique device fingerprints and manages context-aware authentication
 * across multiple devices (desktop, laptop, tablet with keyboard, etc.)
 *
 * Key Features:
 * - Browser-based device fingerprinting
 * - Keyboard hardware detection via timing signatures
 * - Device-specific biometric profiles
 * - Automatic device recognition
 * - Smooth cross-device authentication
 */

const crypto = require('crypto');

/**
 * Generate a device fingerprint from browser/system information
 *
 * @param {Object} deviceInfo - Device information from client
 * @returns {Object} Device fingerprint and metadata
 */
function generateDeviceFingerprint(deviceInfo) {
    if (!deviceInfo) {
        return {
            fingerprint: 'unknown',
            deviceType: 'unknown',
            confidence: 0
        };
    }

    // Extract key device characteristics
    const components = {
        userAgent: deviceInfo.userAgent || '',
        platform: deviceInfo.platform || '',
        screenResolution: deviceInfo.screenResolution || '',
        timezone: deviceInfo.timezone || '',
        language: deviceInfo.language || '',
        hardwareConcurrency: deviceInfo.hardwareConcurrency || 0,
        deviceMemory: deviceInfo.deviceMemory || 0,
        colorDepth: deviceInfo.colorDepth || 0
    };

    // Create stable fingerprint (hash of components)
    const fingerprintString = JSON.stringify(components);
    const fingerprint = crypto
        .createHash('sha256')
        .update(fingerprintString)
        .digest('hex')
        .substring(0, 16); // Use first 16 chars

    // Detect device type
    const deviceType = detectDeviceType(components);

    // Detect keyboard hardware characteristics
    const keyboardSignature = deviceInfo.keyboardSignature || null;

    return {
        fingerprint,
        deviceType,
        components,
        keyboardSignature,
        confidence: calculateFingerprintConfidence(components),
        timestamp: new Date()
    };
}

/**
 * Detect device type from components
 *
 * @param {Object} components - Device characteristics
 * @returns {string} Device type classification
 */
function detectDeviceType(components) {
    const ua = (components.userAgent || '').toLowerCase();
    const platform = (components.platform || '').toLowerCase();

    // Mobile detection (unlikely to have keyboard, but check anyway)
    if (/mobile|android|iphone|ipad|tablet/i.test(ua)) {
        if (/ipad|tablet/i.test(ua)) {
            return 'tablet';
        }
        return 'mobile';
    }

    // Desktop/Laptop detection
    if (/windows|mac|linux/i.test(platform)) {
        // Check screen size to differentiate laptop vs desktop
        const resolution = components.screenResolution || '';
        const [width] = resolution.split('x').map(Number);

        if (width && width >= 1920) {
            return 'desktop';
        } else if (width && width >= 1280) {
            return 'laptop';
        }

        return 'computer';
    }

    return 'unknown';
}

/**
 * Calculate confidence score for fingerprint stability
 *
 * @param {Object} components - Device characteristics
 * @returns {number} Confidence score (0-1)
 */
function calculateFingerprintConfidence(components) {
    let confidence = 0;
    let maxScore = 0;

    // Award points for each available component
    const componentWeights = {
        userAgent: 0.2,
        platform: 0.2,
        screenResolution: 0.15,
        timezone: 0.1,
        language: 0.1,
        hardwareConcurrency: 0.1,
        deviceMemory: 0.1,
        colorDepth: 0.05
    };

    for (let [key, weight] of Object.entries(componentWeights)) {
        maxScore += weight;
        if (components[key]) {
            confidence += weight;
        }
    }

    return confidence / maxScore;
}

/**
 * Detect keyboard hardware characteristics from typing patterns
 * (Mechanical keyboards have different timing signatures than membrane)
 *
 * @param {Array} keystrokeData - Raw keystroke samples
 * @returns {Object} Keyboard signature
 */
function detectKeyboardHardware(keystrokeData) {
    if (!keystrokeData || keystrokeData.length < 50) {
        return null;
    }

    // Extract dwell times
    const dwellTimes = keystrokeData
        .filter(k => k.dwellTime > 0)
        .map(k => k.dwellTime);

    if (dwellTimes.length === 0) {
        return null;
    }

    // Calculate statistics
    const mean = dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length;
    const variance = dwellTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dwellTimes.length;
    const stdDev = Math.sqrt(variance);

    // Mechanical keyboards tend to have:
    // - Lower dwell times (faster key release)
    // - Higher variance (tactile feedback affects timing)
    const isMechanical = mean < 80 && stdDev > 20;

    // Laptop keyboards tend to have:
    // - Medium dwell times
    // - Low variance (consistent shallow travel)
    const isLaptop = mean >= 80 && mean <= 120 && stdDev < 20;

    // External/membrane keyboards:
    // - Higher dwell times
    // - Medium variance
    const isExternal = mean > 120;

    return {
        meanDwellTime: Math.round(mean),
        dwellVariance: Math.round(stdDev),
        classification: isMechanical ? 'mechanical' : (isLaptop ? 'laptop' : 'external'),
        confidence: Math.min(1.0, dwellTimes.length / 100),
        sampleSize: dwellTimes.length
    };
}

/**
 * Check if device fingerprint matches an existing device
 *
 * @param {string} fingerprint - Current device fingerprint
 * @param {Array} knownDevices - List of user's known devices
 * @returns {Object} Match result
 */
function matchDevice(fingerprint, knownDevices) {
    if (!knownDevices || knownDevices.length === 0) {
        return {
            matched: false,
            isNewDevice: true
        };
    }

    // Direct fingerprint match
    const exactMatch = knownDevices.find(d => d.fingerprint === fingerprint);
    if (exactMatch) {
        return {
            matched: true,
            device: exactMatch,
            confidence: 1.0,
            isNewDevice: false
        };
    }

    // Fuzzy matching (in case some components changed slightly)
    // Compare keyboard signatures if available
    for (let device of knownDevices) {
        const similarity = calculateDeviceSimilarity(fingerprint, device);
        if (similarity > 0.8) {
            return {
                matched: true,
                device: device,
                confidence: similarity,
                isNewDevice: false,
                fuzzyMatch: true
            };
        }
    }

    return {
        matched: false,
        isNewDevice: true
    };
}

/**
 * Calculate similarity between two devices
 *
 * @param {string} fingerprint1 - First device fingerprint
 * @param {Object} device2 - Second device object
 * @returns {number} Similarity score (0-1)
 */
function calculateDeviceSimilarity(fingerprint1, device2) {
    // Simple Hamming distance for fingerprints
    const fp2 = device2.fingerprint;

    if (!fingerprint1 || !fp2 || fingerprint1.length !== fp2.length) {
        return 0;
    }

    let matches = 0;
    for (let i = 0; i < fingerprint1.length; i++) {
        if (fingerprint1[i] === fp2[i]) {
            matches++;
        }
    }

    return matches / fingerprint1.length;
}

/**
 * Register a new device for the user
 *
 * @param {Object} deviceFingerprint - Device fingerprint data
 * @param {string} userId - User ID
 * @returns {Object} Registered device info
 */
function registerDevice(deviceFingerprint, userId) {
    return {
        fingerprint: deviceFingerprint.fingerprint,
        deviceType: deviceFingerprint.deviceType,
        components: deviceFingerprint.components,
        keyboardSignature: deviceFingerprint.keyboardSignature,
        userId: userId,
        firstSeen: new Date(),
        lastSeen: new Date(),
        sampleCount: 0,
        trusted: false, // Becomes true after N verified samples
        metadata: {
            userAgent: deviceFingerprint.components.userAgent,
            platform: deviceFingerprint.components.platform
        }
    };
}

/**
 * Update device last seen timestamp
 *
 * @param {Object} device - Device object
 * @returns {Object} Updated device
 */
function updateDeviceActivity(device) {
    device.lastSeen = new Date();
    device.sampleCount = (device.sampleCount || 0) + 1;

    // Mark as trusted after 5+ verified samples
    if (device.sampleCount >= 5) {
        device.trusted = true;
    }

    return device;
}

/**
 * Get appropriate biometric profile for current device context
 *
 * @param {Object} biometric - User's biometric data
 * @param {string} deviceFingerprint - Current device fingerprint
 * @returns {Object} Appropriate profile to use
 */
function getContextProfile(biometric, deviceFingerprint) {
    // If no device fingerprint, use general profile
    if (!deviceFingerprint || !biometric.contextProfiles) {
        return {
            profile: biometric.profile,
            source: 'general'
        };
    }

    // Check for device-specific profile
    const deviceProfile = biometric.contextProfiles.get(deviceFingerprint);

    if (deviceProfile && deviceProfile.sampleCount >= 3) {
        // Use device-specific profile if we have enough samples
        return {
            profile: deviceProfile.profile,
            source: 'device-specific',
            deviceType: deviceProfile.deviceType,
            sampleCount: deviceProfile.sampleCount
        };
    }

    // Fall back to general profile
    return {
        profile: biometric.profile,
        source: 'general',
        note: 'Device-specific profile not yet established'
    };
}

/**
 * Client-side fingerprint collection script
 * (To be sent to frontend for execution)
 *
 * @returns {string} JavaScript code for client-side execution
 */
function getClientFingerprintScript() {
    return `
// Collect device information for fingerprinting
function collectDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenResolution: screen.width + 'x' + screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: navigator.deviceMemory || 0,
        colorDepth: screen.colorDepth || 0
    };
}

// Include this in keystroke submission
const deviceInfo = collectDeviceInfo();
`;
}

module.exports = {
    generateDeviceFingerprint,
    detectDeviceType,
    detectKeyboardHardware,
    matchDevice,
    registerDevice,
    updateDeviceActivity,
    getContextProfile,
    getClientFingerprintScript,
    calculateDeviceSimilarity
};
