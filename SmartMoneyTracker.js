/**
 * SmartMoneyTracker
 * Framework: Eliza
 * Language: JavaScript (Node.js)
 *
 * Purpose: Tracks known profitable ("smart money") wallets to determine
 * whether sophisticated traders are entering or exiting a token position.
 * Smart money exiting is a bearish signal (they know something), while
 * smart money entering is a bullish signal. The tracker reads from a
 * configurable JSON wallet registry.
 *
 * Weight in composite score: 8%
 */

const askLLM = require("./llmClient");
const fs = require("fs");
const path = require("path");

class SmartMoneyTracker {
    constructor() {
        this.name = "SmartMoneyTracker";
        this.description = "Tracks known profitable wallets to detect smart money entry/exit signals.";
        this.weight = 0.08;

        /** @type {string} Path to the smart wallets registry */
        this.walletRegistryPath = path.join(__dirname, "smart_wallets.json");

        /** @type {Array|null} Cached wallet list */
        this._cachedWallets = null;
    }

    /**
     * Loads the smart wallet registry from disk.
     * Caches the result after the first read.
     *
     * @private
     * @returns {Array<{address: string, label: string, confidence: number}>} Array of known smart wallets
     */
    _loadSmartWallets() {
        if (this._cachedWallets) {
            return this._cachedWallets;
        }

        try {
            const raw = fs.readFileSync(this.walletRegistryPath, "utf-8");
            const parsed = JSON.parse(raw);

            if (!parsed.wallets || !Array.isArray(parsed.wallets)) {
                console.warn("[SmartMoneyTracker] Invalid wallet registry format — expected { wallets: [] }");
                return [];
            }

            this._cachedWallets = parsed.wallets;
            console.log(`[SmartMoneyTracker] Loaded ${this._cachedWallets.length} smart wallets (last updated: ${parsed.last_updated || "unknown"})`);
            return this._cachedWallets;
        } catch (error) {
            console.error(`[SmartMoneyTracker] Failed to load wallet registry: ${error.message}`);
            return [];
        }
    }

    /**
     * Analyzes smart money presence in a token's holder list.
     *
     * @param {Object} data - Token holder data
     * @param {Array<{address: string, balance: number}>} data.holders - Current token holders
     * @param {Array<string>} [data.previous_smart_holders] - Smart wallets that held the token previously (for exit detection)
     * @returns {Object} Smart money analysis result
     * @returns {number} return.smart_money_score - Risk score (5-95, 50=neutral)
     * @returns {string} return.smart_money_level - Risk level label
     * @returns {number} return.smart_money_holding - Count of smart wallets currently holding
     * @returns {number} return.smart_money_exiting - Count of smart wallets that exited
     * @returns {string} return.smart_money_details - Human-readable analysis
     * @returns {number} return.weight - Module weight in composite score
     */
    async analyze(data) {
        try {
            if (!data || typeof data !== "object") {
                throw new Error("Invalid or missing holder data.");
            }

            console.log(`[SmartMoneyTracker] Analyzing smart money positions...`);

            // --- Load smart wallet registry ---
            const smartWallets = this._loadSmartWallets();
            if (smartWallets.length === 0) {
                console.warn("[SmartMoneyTracker] No smart wallets loaded — returning neutral score.");
                return this._neutralResult("No smart wallet registry available.");
            }

            // --- Extract current holders ---
            const holders = Array.isArray(data.holders) ? data.holders : [];
            const holderAddresses = new Set(holders.map(h => h.address));

            // --- Build smart wallet address set for O(1) lookup ---
            const smartAddressSet = new Set(smartWallets.map(w => w.address));

            // --- Count smart money currently holding ---
            const smartMoneyHolding = [];
            for (const holder of holders) {
                if (smartAddressSet.has(holder.address)) {
                    const walletInfo = smartWallets.find(w => w.address === holder.address);
                    smartMoneyHolding.push({
                        address: holder.address,
                        balance: holder.balance,
                        label: walletInfo ? walletInfo.label : "Unknown",
                        confidence: walletInfo ? walletInfo.confidence : 0
                    });
                }
            }

            // --- Detect smart money exits (held before, not holding now) ---
            const previousSmartHolders = Array.isArray(data.previous_smart_holders) ? data.previous_smart_holders : [];
            const smartMoneyExiting = [];
            for (const prevAddress of previousSmartHolders) {
                if (smartAddressSet.has(prevAddress) && !holderAddresses.has(prevAddress)) {
                    const walletInfo = smartWallets.find(w => w.address === prevAddress);
                    smartMoneyExiting.push({
                        address: prevAddress,
                        label: walletInfo ? walletInfo.label : "Unknown"
                    });
                }
            }

            // --- Score calculation ---
            // Base score: 50 (neutral)
            let score = 50;

            // Smart money exiting is bearish → increase risk by 20 per exit
            score += smartMoneyExiting.length * 20;

            // Smart money entering (newly holding) is bullish → decrease risk by 15 per entry
            score -= smartMoneyHolding.length * 15;

            // Clamp to valid range
            score = Math.max(5, Math.min(95, score));

            // --- Determine risk level ---
            let level = "NEUTRAL";
            if (score >= 80) level = "VERY_HIGH";
            else if (score >= 65) level = "HIGH";
            else if (score >= 45) level = "NEUTRAL";
            else if (score >= 25) level = "LOW";
            else level = "VERY_LOW";

            console.log(`[SmartMoneyTracker] Holding: ${smartMoneyHolding.length} | Exiting: ${smartMoneyExiting.length} | Score: ${score} | Level: ${level}`);

            // --- Generate AI-enhanced details ---
            let smartMoneyDetails = "";
            try {
                const prompt = `You are a blockchain security analyst specializing in smart money flow analysis.
Analyze this smart money data and provide a 2-3 sentence risk assessment.
Use only the data provided. Do not invent information.

Data:
- Smart wallets currently holding: ${smartMoneyHolding.length} (${smartMoneyHolding.map(w => w.label).join(", ") || "none"})
- Smart wallets that exited: ${smartMoneyExiting.length} (${smartMoneyExiting.map(w => w.label).join(", ") || "none"})
- Total holders analyzed: ${holders.length}
- Risk score: ${score}/100 (50 = neutral, higher = riskier)
- Risk level: ${level}

Provide a concise, professional assessment of what smart money behavior signals about this token.`;

                smartMoneyDetails = await askLLM(prompt, { max_tokens: 250 });
            } catch (_) {
                smartMoneyDetails = this._generateFallbackDetails(smartMoneyHolding, smartMoneyExiting, level);
            }

            // Fallback if LLM returned empty or unavailable
            if (!smartMoneyDetails || smartMoneyDetails === "AI analysis unavailable" || smartMoneyDetails === "AI sentiment analysis unavailable") {
                smartMoneyDetails = this._generateFallbackDetails(smartMoneyHolding, smartMoneyExiting, level);
            }

            return {
                smart_money_score: score,
                smart_money_level: level,
                smart_money_holding: smartMoneyHolding.length,
                smart_money_exiting: smartMoneyExiting.length,
                smart_money_holding_wallets: smartMoneyHolding,
                smart_money_exiting_wallets: smartMoneyExiting,
                smart_money_details: smartMoneyDetails,
                total_smart_wallets_tracked: smartWallets.length,
                weight: this.weight
            };
        } catch (error) {
            console.error(`[SmartMoneyTracker] Error: ${error.message}`);
            return {
                smart_money_score: 50,
                smart_money_level: "UNKNOWN",
                smart_money_holding: 0,
                smart_money_exiting: 0,
                smart_money_holding_wallets: [],
                smart_money_exiting_wallets: [],
                smart_money_details: `Analysis failed: ${error.message}. Defaulting to neutral score.`,
                total_smart_wallets_tracked: 0,
                weight: this.weight
            };
        }
    }

    /**
     * Returns a neutral result when the wallet registry is unavailable.
     * @private
     * @param {string} reason - Reason for neutral result
     * @returns {Object} Neutral analysis result
     */
    _neutralResult(reason) {
        return {
            smart_money_score: 50,
            smart_money_level: "NEUTRAL",
            smart_money_holding: 0,
            smart_money_exiting: 0,
            smart_money_holding_wallets: [],
            smart_money_exiting_wallets: [],
            smart_money_details: reason,
            total_smart_wallets_tracked: 0,
            weight: this.weight
        };
    }

    /**
     * Generates a deterministic fallback summary when LLM is unavailable.
     * @private
     * @param {Array} holding - Smart wallets currently holding
     * @param {Array} exiting - Smart wallets that exited
     * @param {string} level - Calculated risk level
     * @returns {string} Human-readable smart money details
     */
    _generateFallbackDetails(holding, exiting, level) {
        if (exiting.length > 0 && holding.length === 0) {
            return `CRITICAL: ${exiting.length} known profitable wallet(s) have exited this token (${exiting.map(w => w.label).join(", ")}). No smart money remains. Strong bearish signal — smart money may be front-running a dump.`;
        } else if (exiting.length > 0 && holding.length > 0) {
            return `WARNING: ${exiting.length} smart wallet(s) exited while ${holding.length} remain. Mixed signals, but exits from known profitable traders warrant caution.`;
        } else if (holding.length > 0 && exiting.length === 0) {
            return `POSITIVE: ${holding.length} known profitable wallet(s) are holding this token (${holding.map(w => w.label).join(", ")}). Smart money presence is a bullish signal.`;
        }
        return `NEUTRAL: No smart money wallets detected in the current holder list. Insufficient data for smart money signal analysis.`;
    }
}

// Export for Eliza framework / module inclusion
module.exports = SmartMoneyTracker;
