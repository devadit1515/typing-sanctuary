/**
 * Passage Service
 *
 * Intelligent passage selection for biometric training and regular gameplay.
 * Implements progressive difficulty and load balancing.
 */

const Passage = require('../models/Passage');
const KeystrokeBiometrics = require('../models/KeystrokeBiometrics');

/**
 * Get training passage based on user's enrollment progress
 *
 * Progressive difficulty:
 * - Samples 0-4: Complexity 1-2 (easy start)
 * - Samples 5-14: Complexity 2-3 (medium)
 * - Samples 15-29: Complexity 3-4 (advanced)
 * - Samples 30+: Complexity 4-5 (expert)
 *
 * @param {String} userId - User's MongoDB ID
 * @param {String} passageLength - 'short' or 'medium'
 * @returns {Object} Selected passage
 */
async function getTrainingPassage(userId, passageLength = 'medium') {
    try {
        // Get user's biometric record to check progress
        const biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric) {
            // No biometric record - start with easiest passages
            return await selectPassageByComplexity(passageLength, [1, 2]);
        }

        const samplesCollected = biometric.samples ? biometric.samples.length : 0;

        // Determine complexity range based on progress
        let complexityRange;
        if (samplesCollected < 5) {
            complexityRange = [1, 2]; // Easy start
        } else if (samplesCollected < 15) {
            complexityRange = [2, 3]; // Medium
        } else if (samplesCollected < 30) {
            complexityRange = [3, 4]; // Advanced
        } else {
            complexityRange = [4, 5]; // Expert
        }

        return await selectPassageByComplexity(passageLength, complexityRange);

    } catch (error) {
        console.error('Error getting training passage:', error);
        // Fallback to medium complexity
        return await selectPassageByComplexity(passageLength, [2, 3]);
    }
}

/**
 * Select passage within complexity range
 *
 * Uses usage count for load balancing - prefers less-used passages
 *
 * @param {String} passageLength - 'short' or 'medium'
 * @param {Array} complexityRange - [min, max] complexity
 * @returns {Object} Selected passage
 */
async function selectPassageByComplexity(passageLength, complexityRange) {
    try {
        const passage = await Passage.findOne({
            length: passageLength,
            complexity: { $gte: complexityRange[0], $lte: complexityRange[1] },
            isActive: true
        }).sort({ usageCount: 1 }); // Prefer less-used passages

        if (!passage) {
            // Fallback: any active passage of this length
            const fallbackPassage = await Passage.findOne({
                length: passageLength,
                isActive: true
            }).sort({ usageCount: 1 });

            if (fallbackPassage) {
                fallbackPassage.usageCount++;
                await fallbackPassage.save();
                return fallbackPassage;
            }

            // Ultimate fallback - use hardcoded passage
            return {
                text: passageLength === 'short'
                    ? 'the quick brown fox jumps over the lazy dog'
                    : 'The Morning Sun rises over the Mountain peaks bringing New Hope to the valley below where streams flow gently.',
                length: passageLength,
                complexity: 2,
                _id: null
            };
        }

        // Increment usage count
        passage.usageCount++;
        await passage.save();

        return passage;

    } catch (error) {
        console.error('Error selecting passage:', error);
        // Return hardcoded fallback
        return {
            text: passageLength === 'short'
                ? 'the quick brown fox jumps over the lazy dog'
                : 'The Morning Sun rises over the Mountain peaks bringing New Hope to the valley below.',
            length: passageLength,
            complexity: 2,
            _id: null
        };
    }
}

/**
 * Get regular passage for enrolled users or guests
 *
 * Returns passages from existing hardcoded set or database
 *
 * @param {String} passageLength - 'short', 'medium', or 'long'
 * @returns {Object} Passage object with text property
 */
async function getRegularPassage(passageLength = 'medium') {
    // For now, return from hardcoded passages
    // In future, could migrate all passages to database

    const passages = {
        short: [
            "The quick brown fox jumps over the lazy dog.",
            "Pack my box with five dozen liquor jugs.",
            "How vexingly quick daft zebras jump.",
            "Sphinx of black quartz judge my vow.",
            "The five boxing wizards jump quickly."
        ],
        medium: [
            "The morning sun cast golden rays across the valley as birds began their cheerful songs. It was going to be a beautiful day.",
            "In the heart of the ancient forest stood a magnificent oak tree that had witnessed centuries of history unfold beneath its branches.",
            "The waves crashed against the rocky shore with tremendous force sending spray high into the air and creating a misty rainbow.",
            "Technology advances at an incredible pace transforming the way we live work and connect with others around the world every single day.",
            "Mountains rise majestically into the clouds their peaks covered in eternal snow while valleys below teem with life and vibrant colors."
        ],
        long: [
            "The magnificent sunset painted the sky in brilliant shades of orange pink and purple as the day came to a peaceful end. Children played in the park while parents watched from nearby benches enjoying the warm evening breeze. In the distance a church bell rang marking the hour as birds returned to their nests for the night. The city slowly transitioned from the bustle of day to the calm of evening creating a serene atmosphere that everyone appreciated.",
            "Modern technology has revolutionized every aspect of our daily lives from how we communicate and work to how we learn and entertain ourselves. Smartphones have become indispensable tools that keep us connected to the world. Artificial intelligence is transforming industries and creating new possibilities we never imagined. Yet with all these advances we must remember to balance our digital lives with real human connections and experiences that truly matter.",
            "The ancient library contained thousands of books spanning centuries of human knowledge and wisdom. Scholars traveled from distant lands to study its rare manuscripts and historical documents. The building itself was a masterpiece of architecture with towering columns and intricate carvings that told stories of the past. Walking through its halls felt like stepping back in time to an era when the pursuit of knowledge was considered the highest calling.",
            "Deep beneath the ocean surface lies a mysterious world filled with strange and wonderful creatures that few people ever get to see. Bioluminescent fish create their own light in the darkness while giant squids lurk in the depths. Coral reefs teem with colorful life forming complex ecosystems that rival any rainforest. Scientists continue to discover new species proving that we still have much to learn about our own planet.",
            "The mountain expedition required careful planning and preparation as the team would face extreme weather conditions and challenging terrain. Each member had specific responsibilities and carried essential equipment for survival. As they ascended higher the air grew thinner and the temperature dropped significantly. Despite the hardships the breathtaking views and sense of accomplishment made every difficult step worthwhile. Reaching the summit represented the culmination of months of training and dedication."
        ]
    };

    const passageArray = passages[passageLength] || passages.medium;
    const randomIndex = Math.floor(Math.random() * passageArray.length);

    return {
        text: passageArray[randomIndex],
        length: passageLength,
        complexity: 2,
        _id: null
    };
}

/**
 * Get random passage from database (for migration testing)
 *
 * @param {String} passageLength - 'short' or 'medium'
 * @returns {Object} Random passage
 */
async function getRandomPassageFromDB(passageLength = 'medium') {
    try {
        const count = await Passage.countDocuments({ length: passageLength, isActive: true });

        if (count === 0) {
            return await getRegularPassage(passageLength);
        }

        const randomIndex = Math.floor(Math.random() * count);
        const passage = await Passage.findOne({ length: passageLength, isActive: true })
            .skip(randomIndex);

        if (passage) {
            passage.usageCount++;
            await passage.save();
            return passage;
        }

        return await getRegularPassage(passageLength);

    } catch (error) {
        console.error('Error getting random passage from DB:', error);
        return await getRegularPassage(passageLength);
    }
}

module.exports = {
    getTrainingPassage,
    getRegularPassage,
    getRandomPassageFromDB,
    selectPassageByComplexity
};
