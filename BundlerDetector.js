/**
 * BundlerDetector
 * Framework: Eliza
 * Language: JavaScript (Node.js)
 *
 * Purpose: Detects coordinated launch buying (bundling) — a common
 * Solana rug-pull pattern where the deployer or insiders use multiple
 * wallets to buy a large supply percentage in the first blocks after
 * token launch. This creates an artificial appearance of organic demand
 * while concentrating supply for a later dump.
 *
 * Weight: 15% of the overall composite risk score.
 *
 * Expected scanner data fields:
 *   - bundled_wallets {Array}     — List of wallet objects detected as bundled
 *   - bundled_supply_pct {number} — Percentage of supply held by bundled wallets
 *   - first_block_buyers {number} — Number of unique buyers in the first block
 *   - first_5_blocks_buyers {number} — Number of unique buyers in the first 5 blocks
 *   - sniper_supply_pct {number}  — Percentage of supply held by snipers
 */

const askLLM = require("./llmClient");

class BundlerDetector {
    constructor() {
        this.name = "BundlerDetector";
        this.description = "Detects coordinated launch buying (bundling) patterns on Solana token launches.";
        this.weight = 0.15;

        /**
         * Supply percentage thresholds and their base scores.
         * Evaluated in descending order — first match wins.
         */
        this.SUPPLY_THRESHOLDS = [
            { threshold: 50, score: 90, label: "EXTREME" },
            { threshold: 30, score: 70, label: "HIGH" },
            { threshold: 15, score: 50, label: "MODERATE" }
        ];

        /** Bonus points added when first-block buyer count exceeds threshold. */
        this.FIRST_BLOCK_BONUS = 10;
        this.FIRST_BLOCK_BUYER_THRESHOLD = 5;

        /** Bonus points added when bundled wallets share a common funding source. */
        this.SHARED_FUNDING_BONUS = 15;
    }

    /**
     * Analyzes bundler/sniper data and returns a risk assessment.
     * @param {Object} scannerData - Structured bundler data from the token scanner
     * @returns {Object} Bundler risk analysis result
     */
    async analyze(scannerData) {
        if (!scannerData || typeof scannerData !== "object") {
            throw new Error("Invalid or missing scanner data.");
        }

        console.log(`[${this.name}] Scanning for bundled launch activity...`);

        try {
            const bundledWallets = Array.isArray(scannerData.bundled_wallets) ? scannerData.bundled_wallets : [];
            const bundledSupplyPct = typeof scannerData.bundled_supply_pct === "number" ? scannerData.bundled_supply_pct : 0;
            const firstBlockBuyers = typeof scannerData.first_block_buyers === "number" ? scannerData.first_block_buyers : 0;

            // Step 1: Base score from supply percentage thresholds
            let score = this._scoreBySupplyPercentage(bundledSupplyPct);

            // Step 2: First-block buyer bonus
            if (firstBlockBuyers > this.FIRST_BLOCK_BUYER_THRESHOLD) {
                score += this.FIRST_BLOCK_BONUS;
                console.log(`[${this.name}] First-block buyer bonus applied (+${this.FIRST_BLOCK_BONUS}): ${firstBlockBuyers} buyers in first block.`);
            }

            // Step 3: Shared funding source bonus
            if (this._hasSharedFundingSource(bundledWallets)) {
                score += this.SHARED_FUNDING_BONUS;
                console.log(`[${this.name}] Shared funding source bonus applied (+${this.SHARED_FUNDING_BONUS}).`);
            }

            // Cap score at 100
            score = Math.min(100, score);

            // Determine risk level
            const level = this._scoreToLevel(score);

            // Generate detailed analysis
            const details = await this._generateDetails(scannerData, {
                score, level, bundledWallets, bundledSupplyPct, firstBlockBuyers
            });

            console.log(`[${this.name}] Bundler score: ${score}, level: ${level}, wallets: ${bundledWallets.length}`);

            return {
                bundler_risk_score: score,
                bundler_level: level,
                bundled_wallets_count: bundledWallets.length,
                bundled_supply_pct: bundledSupplyPct,
                bundler_details: details,
                weight: this.weight
            };
        } catch (error) {
            console.error(`[${this.name}] Analysis failed: ${error.message}`);

            // Graceful fallback — assume worst case on failure
            return {
                bundler_risk_score: 90,
                bundler_level: "CRITICAL",
                bundled_wallets_count: 0,
                bundled_supply_pct: 0,
                bundler_details: "Bundler analysis failed — defaulting to high risk.",
                weight: this.weight
            };
        }
    }

    /**
     * Determines the base score from the bundled supply percentage.
     * Uses descending threshold checks — first match wins.
     * @private
     * @param {number} supplyPct - Percentage of supply held by bundled wallets
     * @returns {number} Base risk score
     */
    _scoreBySupplyPercentage(supplyPct) {
        for (const tier of this.SUPPLY_THRESHOLDS) {
            if (supplyPct > tier.threshold) {
                return tier.score;
            }
        }

        // Below all thresholds — minimal bundling risk
        // Scale linearly: 0% = 0, 15% = ~50
        if (supplyPct > 0) {
            return Math.round((supplyPct / 15) * 50);
        }

        return 0;
    }

    /**
     * Checks if bundled wallets share a common funding source.
     * A shared funding source strongly indicates coordinated activity.
     * @private
     * @param {Array} wallets - Array of wallet objects from scanner
     * @returns {boolean} True if a common funding source is detected
     */
    _hasSharedFundingSource(wallets) {
        if (!wallets || wallets.length < 2) {
            return false;
        }

        // Check if wallet objects have a funding_source field
        const fundingSources = wallets
            .map(w => w && w.funding_source)
            .filter(Boolean);

        if (fundingSources.length < 2) {
            return false;
        }

        // If any funding source appears more than once, wallets are linked
        const sourceCounts = {};
        for (const source of fundingSources) {
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
            if (sourceCounts[source] >= 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Converts a numeric risk score to a human-readable risk level string.
     * @private
     * @param {number} score - Risk score (0-100)
     * @returns {string} Risk level label
     */
    _scoreToLevel(score) {
        if (score <= 10) return "SAFE";
        if (score <= 30) return "LOW";
        if (score <= 55) return "MODERATE";
        if (score <= 75) return "HIGH";
        return "CRITICAL";
    }

    /**
     * Generates a human-readable detail string using the LLM.
     * Falls back to a static description if LLM is unavailable.
     * @private
     * @param {Object} data - Scanner data
     * @param {Object} analysis - Computed analysis breakdown
     * @returns {Promise<string>} Detailed analysis text
     */
    async _generateDetails(data, analysis) {
        const first5Info = typeof data.first_5_blocks_buyers === "number"
            ? `First 5 blocks buyers: ${data.first_5_blocks_buyers}.`
            : "";
        const sniperInfo = typeof data.sniper_supply_pct === "number"
            ? `Sniper supply: ${data.sniper_supply_pct}%.`
            : "";

        const staticDetail = `Bundled wallets: ${analysis.bundledWallets.length}. `
            + `Bundled supply: ${analysis.bundledSupplyPct}%. `
            + `First-block buyers: ${analysis.firstBlockBuyers}. `
            + `${first5Info} ${sniperInfo} `
            + `Risk score: ${analysis.score}/100 (${analysis.level}).`;

        try {
            const prompt = `Analyze this Solana token launch bundling data and provide a 2-sentence risk assessment:\n`
                + `Bundled Wallets: ${analysis.bundledWallets.length}\n`
                + `Bundled Supply: ${analysis.bundledSupplyPct}%\n`
                + `First Block Buyers: ${analysis.firstBlockBuyers}\n`
                + `${first5Info}\n`
                + `${sniperInfo}\n`
                + `Risk Score: ${analysis.score}/100`;

            const llmResponse = await askLLM(prompt, {
                max_tokens: 150,
                temperature: 0.2
            });

            if (llmResponse && !llmResponse.includes("unavailable")) {
                return `${staticDetail} — AI Assessment: ${llmResponse}`;
            }
        } catch (_err) {
            // Silently fall through to static detail
        }

        return staticDetail.trim();
    }
}

// Export for Eliza framework / module inclusion
module.exports = BundlerDetector;
