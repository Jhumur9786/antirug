/**
 * InsiderWalletScorer
 * Framework: Eliza
 * Language: JavaScript (Node.js)
 *
 * Purpose: Tracks creator/deployer wallet behavior after token launch
 * to detect insider dumping — one of the strongest rug-pull signals.
 * A creator who holds their tokens signals commitment; one who quietly
 * sells everything signals an exit scam.
 *
 * Weight: 12% of the overall composite risk score.
 *
 * Expected scanner data fields:
 *   - creator_wallet {string}               — Creator wallet address
 *   - creator_current_holdings_pct {number}  — % of supply the creator currently holds
 *   - creator_sold_pct {number}              — % of creator's original holdings that have been sold
 *   - creator_fully_exited {boolean}         — Whether the creator has sold 100% of their tokens
 */

const askLLM = require("./llmClient");

class InsiderWalletScorer {
    constructor() {
        this.name = "InsiderWalletScorer";
        this.description = "Tracks creator wallet behavior to detect insider dumping and exit scam signals.";
        this.weight = 0.12;

        /**
         * Risk score mapping based on creator sell-off status.
         * Lower score = safer (creator is holding).
         * Higher score = more dangerous (creator is dumping).
         */
        this.INSIDER_RISK_SCORES = {
            HOLDING: 10,         // sold < 10%
            PARTIALLY_SOLD: 50,  // sold 10-80%
            MOSTLY_SOLD: 80,     // sold 80-99%
            FULLY_EXITED: 95     // sold 100%
        };
    }

    /**
     * Analyzes creator wallet data and returns a risk assessment.
     * @param {Object} scannerData - Structured insider data from the token scanner
     * @returns {Object} Insider wallet risk analysis result
     */
    async analyze(scannerData) {
        if (!scannerData || typeof scannerData !== "object") {
            throw new Error("Invalid or missing scanner data.");
        }

        console.log(`[${this.name}] Analyzing creator wallet behavior...`);

        try {
            // Classify creator behavior and determine risk score
            const { status, score } = this._classifyCreatorStatus(scannerData);

            // Determine human-readable risk level
            const level = this._scoreToLevel(score);

            // Generate detailed analysis via LLM (optional enhancement)
            const details = await this._generateDetails(scannerData, status, score);

            console.log(`[${this.name}] Creator status: ${status}, score: ${score}, level: ${level}`);

            return {
                insider_risk_score: score,
                insider_level: level,
                creator_status: status,
                insider_details: details,
                weight: this.weight
            };
        } catch (error) {
            console.error(`[${this.name}] Analysis failed: ${error.message}`);

            // Graceful fallback — assume worst case on failure
            return {
                insider_risk_score: this.INSIDER_RISK_SCORES.FULLY_EXITED,
                insider_level: "CRITICAL",
                creator_status: "UNKNOWN",
                insider_details: "Insider wallet analysis failed — defaulting to high risk.",
                weight: this.weight
            };
        }
    }

    /**
     * Classifies the creator's sell-off behavior into a named status and score.
     * Uses the creator_fully_exited flag as the primary check, then falls
     * back to creator_sold_pct for granular classification.
     * @private
     * @param {Object} data - Scanner data
     * @returns {{ status: string, score: number }}
     */
    _classifyCreatorStatus(data) {
        // Explicit fully-exited flag takes priority
        if (data.creator_fully_exited === true) {
            return { status: "FULLY_EXITED", score: this.INSIDER_RISK_SCORES.FULLY_EXITED };
        }

        const soldPct = typeof data.creator_sold_pct === "number" ? data.creator_sold_pct : 0;

        // Classification by sold percentage ranges
        if (soldPct >= 100) {
            return { status: "FULLY_EXITED", score: this.INSIDER_RISK_SCORES.FULLY_EXITED };
        }
        if (soldPct >= 80) {
            return { status: "MOSTLY_SOLD", score: this.INSIDER_RISK_SCORES.MOSTLY_SOLD };
        }
        if (soldPct >= 10) {
            return { status: "PARTIALLY_SOLD", score: this.INSIDER_RISK_SCORES.PARTIALLY_SOLD };
        }

        // Creator is still holding (sold < 10%) — safest scenario
        return { status: "HOLDING", score: this.INSIDER_RISK_SCORES.HOLDING };
    }

    /**
     * Converts a numeric risk score to a human-readable risk level string.
     * @private
     * @param {number} score - Risk score (0-100)
     * @returns {string} Risk level label
     */
    _scoreToLevel(score) {
        if (score <= 15) return "SAFE";
        if (score <= 35) return "LOW";
        if (score <= 60) return "MEDIUM";
        if (score <= 85) return "HIGH";
        return "CRITICAL";
    }

    /**
     * Generates a human-readable detail string using the LLM.
     * Falls back to a static description if LLM is unavailable.
     * @private
     * @param {Object} data - Scanner data
     * @param {string} status - Classified creator status
     * @param {number} score - Calculated risk score
     * @returns {Promise<string>} Detailed analysis text
     */
    async _generateDetails(data, status, score) {
        const walletInfo = data.creator_wallet
            ? `Creator wallet: ${data.creator_wallet.slice(0, 8)}...${data.creator_wallet.slice(-4)}.`
            : "Creator wallet: unknown.";
        const holdingsInfo = typeof data.creator_current_holdings_pct === "number"
            ? `Current holdings: ${data.creator_current_holdings_pct}% of supply.`
            : "";
        const soldInfo = typeof data.creator_sold_pct === "number"
            ? `Sold: ${data.creator_sold_pct}% of original position.`
            : "";

        const staticDetail = `Creator status: ${status}. ${walletInfo} ${holdingsInfo} ${soldInfo} Risk score: ${score}/100.`.trim();

        try {
            const prompt = `Analyze this Solana token creator wallet behavior and provide a 2-sentence risk assessment:\n`
                + `Creator Status: ${status}\n`
                + `${holdingsInfo}\n`
                + `${soldInfo}\n`
                + `Fully Exited: ${data.creator_fully_exited || false}\n`
                + `Risk Score: ${score}/100`;

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

        return staticDetail;
    }
}

// Export for Eliza framework / module inclusion
module.exports = InsiderWalletScorer;
