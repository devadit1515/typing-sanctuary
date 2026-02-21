/**
 * Seed Training Passages
 *
 * Seeds 100 diverse training passages for keystroke biometric enrollment.
 * Organized by complexity levels for progressive difficulty.
 */

const mongoose = require('mongoose');
const Passage = require('../models/Passage');
require('dotenv').config();

const trainingPassages = [
    // ========== LEVEL 1: Lowercase + spaces only (20 passages) ==========
    { text: "the quick brown fox jumps over the lazy dog near the riverbank", length: "short", complexity: 1, category: "general" },
    { text: "she sells seashells by the seashore where waves crash on rocks", length: "short", complexity: 1, category: "general" },
    { text: "peter piper picked a peck of pickled peppers from the garden", length: "short", complexity: 1, category: "general" },
    { text: "how much wood would a woodchuck chuck if a woodchuck could chuck", length: "short", complexity: 1, category: "general" },
    { text: "the sun shines brightly over the meadow filled with wildflowers", length: "short", complexity: 1, category: "general" },
    { text: "birds sing sweet melodies in the morning as dawn breaks gently", length: "short", complexity: 1, category: "general" },
    { text: "cats sleep peacefully on warm windowsills during sunny afternoons", length: "short", complexity: 1, category: "general" },
    { text: "children play happily in the park under the watchful eyes of parents", length: "short", complexity: 1, category: "general" },
    { text: "rain falls softly on the roof creating a soothing rhythmic pattern", length: "short", complexity: 1, category: "general" },
    { text: "books line the shelves of the library waiting to share their stories", length: "short", complexity: 1, category: "general" },

    { text: "mountains rise majestically into the clouds covered with green forests and flowing streams below", length: "medium", complexity: 1, category: "general" },
    { text: "waves crash against the rocky shoreline sending spray high into the salty air above", length: "medium", complexity: 1, category: "general" },
    { text: "autumn leaves fall gently from trees painting the ground in shades of red orange and yellow", length: "medium", complexity: 1, category: "general" },
    { text: "stars twinkle brightly in the clear night sky as the moon rises slowly over the horizon", length: "medium", complexity: 1, category: "general" },
    { text: "flowers bloom in the garden releasing sweet fragrances that attract bees and butterflies nearby", length: "medium", complexity: 1, category: "general" },
    { text: "rivers flow steadily through valleys carving paths through ancient rock formations over time", length: "medium", complexity: 1, category: "general" },
    { text: "snow falls quietly blanketing the landscape in pure white creating a serene winter wonderland", length: "medium", complexity: 1, category: "general" },
    { text: "music fills the concert hall as talented musicians perform beautiful symphonies for the audience", length: "medium", complexity: 1, category: "general" },
    { text: "bread bakes slowly in the warm oven filling the house with wonderful comforting aromas", length: "medium", complexity: 1, category: "general" },
    { text: "trains travel swiftly along steel tracks connecting distant cities and bringing people together", length: "medium", complexity: 1, category: "general" },

    // ========== LEVEL 2: Mixed case (20 passages) ==========
    { text: "The Morning Sun rises Over the Mountain Peaks bringing New Hope", length: "short", complexity: 2, category: "general" },
    { text: "Alice and Bob Walked Through the Garden on a Sunny Spring Day", length: "short", complexity: 2, category: "general" },
    { text: "Technology Changes Rapidly While Human Nature Remains Constant", length: "short", complexity: 2, category: "general" },
    { text: "Reading Good Books Expands the Mind and Enriches the Soul Deeply", length: "short", complexity: 2, category: "general" },
    { text: "Creative Thinking Leads to Innovation and Progress in Every Field", length: "short", complexity: 2, category: "general" },
    { text: "Friendship Requires Trust Honesty and Mutual Respect to Flourish", length: "short", complexity: 2, category: "general" },
    { text: "Practice Makes Perfect When Learning Any New Skill or Discipline", length: "short", complexity: 2, category: "general" },
    { text: "Nature Provides Beauty Wisdom and Inspiration for Those Who Observe", length: "short", complexity: 2, category: "general" },
    { text: "Success Comes From Hard Work Dedication and Never Giving Up Hope", length: "short", complexity: 2, category: "general" },
    { text: "Knowledge Is Power But Wisdom Is Knowing How to Use It Well", length: "short", complexity: 2, category: "general" },

    { text: "The Ancient Library Contains Thousands of Books Spanning Centuries of Human Knowledge and Wisdom", length: "medium", complexity: 2, category: "general" },
    { text: "Mountains Challenge Climbers to Push Beyond Their Limits and Discover Inner Strength and Courage", length: "medium", complexity: 2, category: "general" },
    { text: "Technology Connects People Across Continents Enabling Instant Communication and Global Collaboration", length: "medium", complexity: 2, category: "general" },
    { text: "Artists Express Emotions Through Colors Shapes and Textures Creating Visual Stories for All Ages", length: "medium", complexity: 2, category: "general" },
    { text: "Education Opens Doors to Opportunity and Empowers Individuals to Change Their Lives Forever", length: "medium", complexity: 2, category: "general" },
    { text: "Teamwork Achieves More Than Individual Effort When People Combine Their Unique Skills and Talents", length: "medium", complexity: 2, category: "general" },
    { text: "Innovation Drives Progress as Creative Minds Solve Problems in New and Unexpected Ways", length: "medium", complexity: 2, category: "general" },
    { text: "The Ocean Holds Mysteries Yet to Be Discovered in Its Dark Depths and Hidden Underwater Caves", length: "medium", complexity: 2, category: "general" },
    { text: "Music Transcends Language Barriers Speaking Directly to the Heart and Soul of Every Listener", length: "medium", complexity: 2, category: "general" },
    { text: "Courage Means Facing Fear Not the Absence of It When Making Difficult Decisions Daily", length: "medium", complexity: 2, category: "general" },

    // ========== LEVEL 3: Letters + numbers (20 passages) ==========
    { text: "Agent 007 arrived at 9pm with 5 documents and 3 USB drives", length: "short", complexity: 3, category: "technical" },
    { text: "The year 2025 marks 100 years since the discovery in 1925", length: "short", complexity: 3, category: "general" },
    { text: "Room 42 on Floor 13 contains 256 files from Project Alpha 7", length: "short", complexity: 3, category: "technical" },
    { text: "In 1969 Apollo 11 landed 3 astronauts on the moon for 21 hours", length: "short", complexity: 3, category: "general" },
    { text: "Database Server 8 processed 10000 requests in just 30 seconds", length: "short", complexity: 3, category: "technical" },
    { text: "Flight 1234 departs Gate 56 at 7am and arrives by 2pm today", length: "short", complexity: 3, category: "general" },
    { text: "Version 3 of the software adds 50 new features and fixes 200 bugs", length: "short", complexity: 3, category: "technical" },
    { text: "Team Alpha 6 scored 95 points defeating Team Beta 4 by 20 points", length: "short", complexity: 3, category: "general" },
    { text: "Chapter 12 covers pages 234 through 299 with 15 practice problems", length: "short", complexity: 3, category: "general" },
    { text: "Route 66 stretches 2448 miles from Chicago to Santa Monica Beach", length: "short", complexity: 3, category: "general" },

    { text: "The server at IP address 192 168 1 100 responded within 50 milliseconds using port 8080 successfully", length: "medium", complexity: 3, category: "technical" },
    { text: "Student ID 123456 scored 98 percent on Test 4 ranking 2nd out of 250 students this semester", length: "medium", complexity: 3, category: "general" },
    { text: "Model XJ9 from 2024 achieves 60 miles per gallon and seats 5 passengers very comfortably", length: "medium", complexity: 3, category: "technical" },
    { text: "Package 789 weighing 15 pounds will arrive between 2pm and 5pm on March 28 at Building 3", length: "medium", complexity: 3, category: "general" },
    { text: "Algorithm V7 processed 1 million records in 42 seconds using only 512 megabytes of memory", length: "medium", complexity: 3, category: "technical" },
    { text: "Channel 11 broadcasts from 6am to midnight covering news sports and entertainment 7 days weekly", length: "medium", complexity: 3, category: "general" },
    { text: "Experiment 42 tested 500 samples over 30 days yielding 95 percent accuracy in all cases", length: "medium", complexity: 3, category: "technical" },
    { text: "Highway 101 connects 25 cities spanning 800 miles along the coast from north to south", length: "medium", complexity: 3, category: "general" },
    { text: "Protocol 9 requires 256 bit encryption keys changed every 90 days for maximum security always", length: "medium", complexity: 3, category: "technical" },
    { text: "Building 7 has 50 floors with 1200 offices housing 3000 employees across 8 departments total", length: "medium", complexity: 3, category: "general" },

    // ========== LEVEL 4: Letters + numbers + punctuation (20 passages) ==========
    { text: "Hello, World! The year is 2025. We have 100 users and 50% growth.", length: "short", complexity: 4, category: "technical" },
    { text: "Question: What's 2+2? Answer: 4! That's correct, well done.", length: "short", complexity: 4, category: "general" },
    { text: "Error: File not found (code: 404). Please check the path again.", length: "short", complexity: 4, category: "technical" },
    { text: "Today's date is 12/17/2025, and it's 3:45pm. Don't be late!", length: "short", complexity: 4, category: "general" },
    { text: "Price: $99.99 (save 20%!). Limited time offer, ends Friday!", length: "short", complexity: 4, category: "general" },
    { text: "Status: OK (200). Latency: 45ms. Uptime: 99.9% this month.", length: "short", complexity: 4, category: "technical" },
    { text: "Recipe calls for: 2 cups flour, 1/2 tsp salt, 3 eggs (beaten).", length: "short", complexity: 4, category: "general" },
    { text: "Warning! Temperature exceeds 95°F. Please stay hydrated, folks.", length: "short", complexity: 4, category: "general" },
    { text: "Login failed (3/5 attempts). Password must be 8+ characters!", length: "short", complexity: 4, category: "technical" },
    { text: "Math problem: (3 x 4) + 7 = ? Hint: it's less than 20.", length: "short", complexity: 4, category: "general" },

    { text: "Dear User, your order (#12345) will arrive on 3/15. Total: $249.99. Questions? Call 1-800-555-0123.", length: "medium", complexity: 4, category: "general" },
    { text: "System update available! Version 2.5 fixes bugs #301, #405. Download now? (Yes/No)", length: "medium", complexity: 4, category: "technical" },
    { text: "Recipe: Mix 2.5 cups flour, 1/4 tsp baking soda. Bake at 350°F for 25-30 minutes. Enjoy!", length: "medium", complexity: 4, category: "general" },
    { text: "Meeting scheduled: Monday, 9:30am (Room 204). Topics: Q1 results, budget review. Confirm ASAP!", length: "medium", complexity: 4, category: "general" },
    { text: "Test scores: Alice (95%), Bob (87%), Carol (92%). Class average: 91.3%. Great work, everyone!", length: "medium", complexity: 4, category: "general" },
    { text: "Error 500: Internal server fault. Retry in 60 seconds. Contact admin@example.com if persists.", length: "medium", complexity: 4, category: "technical" },
    { text: "GPS coordinates: 37.7749° N, 122.4194° W (San Francisco, CA). Elevation: 52 feet above sea level.", length: "medium", complexity: 4, category: "technical" },
    { text: "Sale! 40% off items marked (*). Use code SAVE40 at checkout. Offer ends 12/31. Shop now!", length: "medium", complexity: 4, category: "general" },
    { text: "Flight status: AA1234 (on-time). Departs: 2:15pm, Gate C42. Boarding starts 1:45pm. Have ID ready!", length: "medium", complexity: 4, category: "general" },
    { text: "Debug info: Line 42, function getUserData(). TypeError: Cannot read property 'name'. Check console!", length: "medium", complexity: 4, category: "technical" },

    // ========== LEVEL 5: All characters including special symbols (20 passages) ==========
    { text: "P@ssw0rd! Use #hashtags, $money, 100% success & <symbols> {everywhere}.", length: "short", complexity: 5, category: "technical" },
    { text: "Email: user@example.com | Password: S3cur3*P@ss! | Login @app.io", length: "short", complexity: 5, category: "technical" },
    { text: "Coding: var x = 5; if (x > 3) { console.log('Yes!'); } // Works!", length: "short", complexity: 5, category: "technical" },
    { text: "Math: (5 + 3) * 2 - 7 = 9 [correct]. Try: 100% - 50% = 50%!", length: "short", complexity: 5, category: "mixed" },
    { text: "File path: C:\\Users\\Admin\\Documents\\file_2025.txt ~important~", length: "short", complexity: 5, category: "technical" },
    { text: "HTML: <div class='box'>Hello World!</div> <!-- end --> {done}", length: "short", complexity: 5, category: "technical" },
    { text: "Price list: Item #1 = $19.99*, Item #2 = $29.99 (~30% off!)", length: "short", complexity: 5, category: "mixed" },
    { text: "Regex: /^[a-z0-9_-]{3,16}$/ matches usernames. Test: user_123!", length: "short", complexity: 5, category: "technical" },
    { text: "SQL: SELECT * FROM users WHERE id >= 100 AND status != 'banned';", length: "short", complexity: 5, category: "technical" },
    { text: "Tweet: #AI is amazing! @OpenAI GPT-4 = mind = blown. https://ai.com", length: "short", complexity: 5, category: "mixed" },

    { text: "Config file: {\"port\": 8080, \"host\": \"localhost\", \"ssl\": true, \"timeout\": 30000} // JSON format!", length: "medium", complexity: 5, category: "technical" },
    { text: "Terminal: $ npm install --save express@4.18.2 && node server.js // Start app! (ctrl+c to stop)", length: "medium", complexity: 5, category: "technical" },
    { text: "Currency: $1,234.56 USD = €1,089.23 EUR (exchange rate: 1.13). Fees: ~2.5% per transaction!", length: "medium", complexity: 5, category: "mixed" },
    { text: "Function: const add = (a, b) => a + b; // Returns sum! Example: add(5, 3) === 8 [true]", length: "medium", complexity: 5, category: "technical" },
    { text: "Markdown: **Bold text**, *italic*, `code`, [link](url.com), > quote, - list item # heading!", length: "medium", complexity: 5, category: "technical" },
    { text: "Password rules: 8+ chars, 1 UPPER, 1 lower, 1 number (0-9), 1 symbol (!@#$%^&*). Example: MyP@ss123!", length: "medium", complexity: 5, category: "technical" },
    { text: "Array: let data = [1, 2, 3]; data.map(x => x * 2); // Returns [2, 4, 6] <-- doubled values!", length: "medium", complexity: 5, category: "technical" },
    { text: "Git: git commit -m \"Fix bug #42: Update auth validation\" && git push origin main // Deploy now!", length: "medium", complexity: 5, category: "technical" },
    { text: "CSS: .button { color: #FF5733; margin: 10px 20px; transition: all 0.3s ease-in-out; } /* Smooth! */", length: "medium", complexity: 5, category: "technical" },
    { text: "API call: fetch('https://api.example.com/data?id=123&format=json').then(res => res.json()) // GET request!", length: "medium", complexity: 5, category: "technical" }
];

async function seedDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');

        // Clear existing passages
        const deleteResult = await Passage.deleteMany({});
        console.log(`✓ Cleared ${deleteResult.deletedCount} existing passages`);

        // Insert new passages
        const insertResult = await Passage.insertMany(trainingPassages);
        console.log(`✓ Inserted ${insertResult.length} training passages`);

        // Display summary
        const summary = await Passage.aggregate([
            {
                $group: {
                    _id: { complexity: '$complexity', length: '$length' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.complexity': 1, '_id.length': 1 } }
        ]);

        console.log('\n📊 Passage Distribution:');
        summary.forEach(item => {
            console.log(`  Complexity ${item._id.complexity} (${item._id.length}): ${item.count} passages`);
        });

        console.log('\n✅ Database seeding completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

// Run seeding
seedDatabase();
