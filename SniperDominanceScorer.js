/**
 * SniperDominanceScorer
 * Framework: Eliza
 * Language: JavaScript (Node.js)
 *
 * Purpose: Analyzes early supply capture by sniper bots in the first blocks
 * after a token launches on Solana. High sniper dominance indicates that
 * automated actors captured significant supply before organic buyers could
 * participate — a strong rug-pull precursor signal.
 *
 * Weight in composite score: 8%
 */

const askLLM = require("./llmClient");

class SniperDominanceScorer {
    constructor() {
        this.name = "SniperDominanceScorer";
        this.description = "Analyzes early supply capture by sniper bots to detect coordinated launch exploitation.";
        this.weight = 0.08;

        /** @type {Object<string, number>} Risk level thresholds */
        this.THRESHOLDS = {
            CRITICAL: 40,   // >40% supply captured by snipers
            HIGH: 25,       // >25%
            MEDIUM: 10,     // >10%
        };
    }

    /**
     * Analyzes sniper bot dominance from token launch data.
     *
     * @param {Object} data - Sniper activity data from the scanner
     * @param {number} data.sniper_supply_pct - Percentage of supply captured by sniper wallets
     * @param {number} data.first_block_buyers - Number of buyers in the first block after launch
     * @param {number} data.first_5_blocks_buyers - Number of buyers in the first 5 blocks
     * @returns {Object} Sniper risk analysis result
     * @returns {number} return.sniper_risk_score - Risk score (0-100)
     * @returns {string} return.sniper_level - Risk level label
     * @returns {string} return.sniper_details - Human-readable risk explanation
     * @returns {number} return.weight - Module weight in composite score
     */
    async analyze(data) {
        try {
            if (!data || typeof data !== "object") {
                throw new Error("Invalid or missing sniper data.");
            }

            console.log(`[SniperDominanceScorer] Analyzing sniper activity...`);

            // --- Input extraction with safe defaults ---
            const sniperSupplyPct = typeof data.sniper_supply_pct === "number" ? data.sniper_supply_pct : 0;
            const firstBlockBuyers = typeof data.first_block_buyers === "number" ? data.first_block_buyers : 0;
            const first5BlocksBuyers = typeof data.first_5_blocks_buyers === "number" ? data.first_5_blocks_buyers : 0;

            // --- Deterministic scoring ---
            let score = 15;
            let level = "LOW";

            if (sniperSupplyPct > this.THRESHOLDS.CRITICAL) {
                score = 85;
                level = "VERY_HIGH";
            } else if (sniperSupplyPct > this.THRESHOLDS.HIGH) {
                score = 65;
                level = "HIGH";
            } else if (sniperSupplyPct > this.THRESHOLDS.MEDIUM) {
                score = 40;
                level = "MEDIUM";
            }

            console.log(`[SniperDominanceScorer] Sniper supply: ${sniperSupplyPct}% | Score: ${score} | Level: ${level}`);

            // --- Generate AI-enhanced details ---
            let sniperDetails = "";
            try {
                const prompt = `You are a blockchain security analyst specializing in Solana token launches.
Analyze this sniper bot activity data and provide a 2-3 sentence risk assessment.
Use only the data provided. Do not invent information.

Data:
- Sniper supply capture: ${sniperSupplyPct}%
- First block buyers: ${firstBlockBuyers}
- First 5 blocks buyers: ${first5BlocksBuyers}
- Risk score: ${score}/100
- Risk level: ${level}

Provide a concise, professional assessment of the sniper dominance risk.`;

                sniperDetails = await askLLM(prompt, { max_tokens: 200 });
            } catch (_) {
                sniperDetails = this._generateFallbackDetails(sniperSupplyPct, firstBlockBuyers, first5BlocksBuyers, level);
            }

            // Fallback if LLM returned empty or unavailable
            if (!sniperDetails || sniperDetails === "AI analysis unavailable" || sniperDetails === "AI sentiment analysis unavailable") {
                sniperDetails = this._generateFallbackDetails(sniperSupplyPct, firstBlockBuyers, first5BlocksBuyers, level);
            }

            return {
                sniper_risk_score: score,
                sniper_level: level,
                sniper_details: sniperDetails,
                sniper_supply_pct: sniperSupplyPct,
                first_block_buyers: firstBlockBuyers,
                first_5_blocks_buyers: first5BlocksBuyers,
                weight: this.weight
            };
        } catch (error) {
            console.error(`[SniperDominanceScorer] Error: ${error.message}`);
            return {
                sniper_risk_score: 50,
                sniper_level: "UNKNOWN",
                sniper_details: `Analysis failed: ${error.message}. Defaulting to neutral score.`,
                sniper_supply_pct: 0,
                first_block_buyers: 0,
                first_5_blocks_buyers: 0,
                weight: this.weight
            };
        }
    }

    /**
     * Generates a deterministic fallback summary when LLM is unavailable.
     * @private
     * @param {number} sniperPct - Sniper supply percentage
     * @param {number} firstBlock - First block buyer count
     * @param {number} first5Blocks - First 5 blocks buyer count
     * @param {string} level - Calculated risk level
     * @returns {string} Human-readable risk details
     */
    _generateFallbackDetails(sniperPct, firstBlock, first5Blocks, level) {
        if (level === "VERY_HIGH") {
            return `CRITICAL: Sniper bots captured ${sniperPct}% of total supply. ${firstBlock} buyers in the first block and ${first5Blocks} in the first 5 blocks indicate coordinated bot activity. Extremely high rug-pull risk.`;
        } else if (level === "HIGH") {
            return `WARNING: Sniper bots hold ${sniperPct}% of supply. ${firstBlock} first-block buyers suggest automated buying pressure. Elevated risk of coordinated dump.`;
        } else if (level === "MEDIUM") {
            return `MODERATE: ${sniperPct}% supply captured by early snipers. ${first5Blocks} buyers in the first 5 blocks. Some bot activity detected but within tolerable range.`;
        }
        return `LOW RISK: Sniper activity is minimal at ${sniperPct}% supply capture. Launch appears organic with ${first5Blocks} buyers in the first 5 blocks.`;
    }
}

// Export for Eliza framework / module inclusion
module.exports = SniperDominanceScorer;
