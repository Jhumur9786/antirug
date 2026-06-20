/**
 * LPLockAnalyzer
 * Framework: Eliza
 * Language: JavaScript (Node.js)
 *
 * Purpose: Analyzes liquidity pool (LP) lock status for Solana tokens
 * and assigns a risk score based on whether LP tokens are burned,
 * locked (and for how long), or remain unlocked.
 *
 * Weight: 12% of the overall composite risk score.
 *
 * Expected scanner data fields:
 *   - lp_burned {boolean}         — Whether LP tokens have been permanently burned
 *   - lp_locked {boolean}         — Whether LP tokens are locked in a vesting contract
 *   - lock_duration_days {number} — Duration of the LP lock in days
 *   - lock_percentage {number}    — Percentage of LP tokens that are locked (0-100)
 *   - unlock_date {string|null}   — ISO date string when LP tokens unlock
 *   - liquidity_usd {number}      — Total liquidity value in USD
 */

const askLLM = require("./llmClient");

class LPLockAnalyzer {
    constructor() {
        this.name = "LPLockAnalyzer";
        this.description = "Analyzes LP lock status to assess liquidity rug-pull risk.";
        this.weight = 0.12;

        /**
         * Risk score mapping based on LP lock status.
         * Lower score = safer. Higher score = more dangerous.
         */
        this.LP_RISK_SCORES = {
            BURNED: 5,
            LOCKED_LONG: 15,    // > 365 days
            LOCKED_MEDIUM: 40,  // 90-365 days
            LOCKED_SHORT: 70,   // < 90 days
            UNLOCKED: 95
        };
    }

    /**
     * Analyzes LP lock data and returns a risk assessment.
     * @param {Object} scannerData - Structured LP data from the token scanner
     * @returns {Object} LP lock risk analysis result
     */
    async analyze(scannerData) {
        if (!scannerData || typeof scannerData !== "object") {
            throw new Error("Invalid or missing scanner data.");
        }

        console.log(`[${this.name}] Analyzing LP lock status...`);

        try {
            // Determine LP lock status and base risk score
            const { status, score } = this._classifyLPStatus(scannerData);

            // Apply lock percentage modifier — partial locks are riskier
            const adjustedScore = this._applyLockPercentageModifier(score, scannerData);

            // Determine human-readable risk level
            const level = this._scoreToLevel(adjustedScore);

            // Generate detailed analysis via LLM (optional enhancement)
            const details = await this._generateDetails(scannerData, status, adjustedScore);

            console.log(`[${this.name}] LP status: ${status}, score: ${adjustedScore}, level: ${level}`);

            return {
                lp_lock_risk_score: adjustedScore,
                lp_lock_status: status,
                lp_lock_level: level,
                lp_lock_details: details,
                weight: this.weight
            };
        } catch (error) {
            console.error(`[${this.name}] Analysis failed: ${error.message}`);

            // Graceful fallback — assume worst case on failure
            return {
                lp_lock_risk_score: this.LP_RISK_SCORES.UNLOCKED,
                lp_lock_status: "UNKNOWN",
                lp_lock_level: "CRITICAL",
                lp_lock_details: "LP lock analysis failed — defaulting to high risk.",
                weight: this.weight
            };
        }
    }

    /**
     * Classifies the LP lock status into a named tier and base score.
     * @private
     * @param {Object} data - Scanner data
     * @returns {{ status: string, score: number }}
     */
    _classifyLPStatus(data) {
        // LP burned is the safest — tokens are permanently destroyed
        if (data.lp_burned === true) {
            return { status: "BURNED", score: this.LP_RISK_SCORES.BURNED };
        }

        // LP locked — risk depends on lock duration
        if (data.lp_locked === true) {
            const duration = typeof data.lock_duration_days === "number" ? data.lock_duration_days : 0;

            if (duration > 365) {
                return { status: "LOCKED_LONG", score: this.LP_RISK_SCORES.LOCKED_LONG };
            } else if (duration >= 90) {
                return { status: "LOCKED_MEDIUM", score: this.LP_RISK_SCORES.LOCKED_MEDIUM };
            } else {
                return { status: "LOCKED_SHORT", score: this.LP_RISK_SCORES.LOCKED_SHORT };
            }
        }

        // Default: unlocked LP — highest risk
        return { status: "UNLOCKED", score: this.LP_RISK_SCORES.UNLOCKED };
    }

    /**
     * Applies a modifier based on what percentage of LP is actually locked.
     * If only a small portion of LP is locked, the risk should be higher
     * than the base score suggests.
     * @private
     * @param {number} baseScore - The base risk score from classification
     * @param {Object} data - Scanner data
     * @returns {number} Adjusted risk score (capped at 0-100)
     */
    _applyLockPercentageModifier(baseScore, data) {
        // Only apply modifier if LP is locked and we have lock percentage data
        if (data.lp_burned === true || data.lp_locked !== true) {
            return baseScore;
        }

        const lockPct = typeof data.lock_percentage === "number" ? data.lock_percentage : 100;

        // If less than 100% is locked, interpolate toward the unlocked score
        if (lockPct < 100) {
            const unlocked = this.LP_RISK_SCORES.UNLOCKED;
            const blended = baseScore + ((unlocked - baseScore) * (1 - lockPct / 100));
            return Math.min(100, Math.round(blended));
        }

        return baseScore;
    }

    /**
     * Converts a numeric risk score to a human-readable risk level string.
     * @private
     * @param {number} score - Risk score (0-100)
     * @returns {string} Risk level label
     */
    _scoreToLevel(score) {
        if (score <= 10) return "SAFE";
        if (score <= 25) return "LOW";
        if (score <= 50) return "MEDIUM";
        if (score <= 75) return "HIGH";
        return "CRITICAL";
    }

    /**
     * Generates a human-readable detail string using the LLM.
     * Falls back to a static description if LLM is unavailable.
     * @private
     * @param {Object} data - Scanner data
     * @param {string} status - Classified LP status
     * @param {number} score - Calculated risk score
     * @returns {Promise<string>} Detailed analysis text
     */
    async _generateDetails(data, status, score) {
        const unlockInfo = data.unlock_date
            ? `Unlock date: ${data.unlock_date}.`
            : "No unlock date specified.";
        const liquidityInfo = typeof data.liquidity_usd === "number"
            ? `Total liquidity: $${data.liquidity_usd.toLocaleString()}.`
            : "";
        const lockPctInfo = typeof data.lock_percentage === "number"
            ? `${data.lock_percentage}% of LP locked.`
            : "";

        const staticDetail = `LP status: ${status}. Risk score: ${score}/100. ${lockPctInfo} ${unlockInfo} ${liquidityInfo}`.trim();

        try {
            const prompt = `Analyze this Solana token LP lock data and provide a 2-sentence risk assessment:\n`
                + `LP Status: ${status}\n`
                + `Lock Duration: ${data.lock_duration_days || "N/A"} days\n`
                + `Lock Percentage: ${data.lock_percentage || "N/A"}%\n`
                + `${unlockInfo}\n`
                + `${liquidityInfo}\n`
                + `Risk Score: ${score}/100`;

            const llmResponse = await askLLM(prompt, {
                max_tokens: 150,
                temperature: 0.2
            });

            // If LLM returned a useful response, append it to the static details
            if (llmResponse && !llmResponse.includes("unavailable")) {
                return `${staticDetail} — AI Assessment: ${llmResponse}`;
            }
        } catch (_err) {
            // Silently fall through to static detail
        }

        return staticDetail;
    }
}

// Export for Eliza framework / module inclusion
module.exports = LPLockAnalyzer;
