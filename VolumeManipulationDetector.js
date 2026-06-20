/**
 * VolumeManipulationDetector
 * Framework: Eliza
 * Language: JavaScript (Node.js)
 *
 * Purpose: Detects wash trading and artificial volume inflation on Solana tokens.
 * Wash trading is a common rug-pull preparation technique where a single actor
 * trades with themselves across multiple wallets to create the illusion of
 * legitimate market activity. This module flags tokens where volume is
 * disproportionately high relative to the number of unique traders.
 *
 * Weight in composite score: 10%
 */

const askLLM = require("./llmClient");

class VolumeManipulationDetector {
    constructor() {
        this.name = "VolumeManipulationDetector";
        this.description = "Detects wash trading and artificial volume manipulation by analyzing trader-to-volume ratios.";
        this.weight = 0.10;

        /** @type {Object} Detection thresholds */
        this.THRESHOLDS = {
            LOW_TRADERS: 20,             // Below this = suspiciously few traders
            HIGH_VOLUME: 100000,         // $100k+ with few traders = likely wash
            EXTREME_VOL_PER_TRADER: 50000, // $50k per trader = extreme
            HIGH_VOL_PER_TRADER: 10000,    // $10k per trader = elevated
            SCANNER_WASH_FLOOR: 50         // External scanner wash score threshold
        };
    }

    /**
     * Analyzes volume data for signs of wash trading and manipulation.
     *
     * @param {Object} data - Volume and trading activity data
     * @param {number} data.unique_traders_24h - Count of unique wallet addresses that traded in 24h
     * @param {number} data.volume_24h - Total trading volume in USD over 24h
     * @param {number} data.wash_trade_score - External scanner's wash trading score (0-100)
     * @param {number} data.transactions_24h - Total transaction count in 24h
     * @returns {Object} Volume manipulation analysis result
     * @returns {number} return.volume_manipulation_score - Risk score (0-100)
     * @returns {string} return.volume_manipulation_level - Risk level label
     * @returns {number} return.unique_traders - Unique trader count used
     * @returns {number} return.volume_per_trader - Calculated volume per trader
     * @returns {string} return.manipulation_details - Human-readable analysis
     * @returns {number} return.weight - Module weight in composite score
     */
    async analyze(data) {
        try {
            if (!data || typeof data !== "object") {
                throw new Error("Invalid or missing volume data.");
            }

            console.log(`[VolumeManipulationDetector] Analyzing volume patterns...`);

            // --- Input extraction with safe defaults ---
            const uniqueTraders = typeof data.unique_traders_24h === "number" ? data.unique_traders_24h : 0;
            const volume24h = typeof data.volume_24h === "number" ? data.volume_24h : 0;
            const washTradeScore = typeof data.wash_trade_score === "number" ? data.wash_trade_score : 0;
            const transactions24h = typeof data.transactions_24h === "number" ? data.transactions_24h : 0;

            // --- Calculate volume per trader metric ---
            const volumePerTrader = uniqueTraders > 0 ? volume24h / uniqueTraders : 0;

            // --- Deterministic scoring ---
            let score = 15;
            let level = "LOW";
            let triggerReason = "Normal trading activity";

            // Rule 1: Very few traders + high volume = likely wash trading
            if (uniqueTraders < this.THRESHOLDS.LOW_TRADERS && volume24h > this.THRESHOLDS.HIGH_VOLUME) {
                score = 90;
                level = "VERY_HIGH";
                triggerReason = `Only ${uniqueTraders} unique traders generated $${volume24h.toLocaleString()} volume — likely wash trading`;
            }
            // Rule 2: Extreme volume per trader
            else if (volumePerTrader > this.THRESHOLDS.EXTREME_VOL_PER_TRADER) {
                score = 80;
                level = "HIGH";
                triggerReason = `Volume per trader ($${Math.round(volumePerTrader).toLocaleString()}) exceeds $50k threshold`;
            }
            // Rule 3: Elevated volume per trader
            else if (volumePerTrader > this.THRESHOLDS.HIGH_VOL_PER_TRADER) {
                score = 60;
                level = "MEDIUM";
                triggerReason = `Volume per trader ($${Math.round(volumePerTrader).toLocaleString()}) exceeds $10k threshold`;
            }

            // Rule 4: External scanner wash score override (take maximum)
            if (washTradeScore > this.THRESHOLDS.SCANNER_WASH_FLOOR && washTradeScore > score) {
                score = washTradeScore;
                level = washTradeScore >= 80 ? "VERY_HIGH" : washTradeScore >= 60 ? "HIGH" : "MEDIUM";
                triggerReason = `External scanner wash trade score (${washTradeScore}) overrides internal score`;
            }

            console.log(`[VolumeManipulationDetector] Traders: ${uniqueTraders} | Vol/Trader: $${Math.round(volumePerTrader)} | Score: ${score} | Level: ${level}`);

            // --- Generate AI-enhanced details ---
            let manipulationDetails = "";
            try {
                const prompt = `You are a blockchain security analyst specializing in wash trading detection.
Analyze this volume data and provide a 2-3 sentence risk assessment.
Use only the data provided. Do not invent information.

Data:
- Unique traders (24h): ${uniqueTraders}
- Volume (24h): $${volume24h.toLocaleString()}
- Volume per trader: $${Math.round(volumePerTrader).toLocaleString()}
- Transactions (24h): ${transactions24h}
- External wash trade score: ${washTradeScore}
- Risk score: ${score}/100
- Risk level: ${level}
- Trigger: ${triggerReason}

Provide a concise, professional assessment of volume manipulation risk.`;

                manipulationDetails = await askLLM(prompt, { max_tokens: 250 });
            } catch (_) {
                manipulationDetails = this._generateFallbackDetails(uniqueTraders, volume24h, volumePerTrader, level, triggerReason);
            }

            // Fallback if LLM returned empty or unavailable
            if (!manipulationDetails || manipulationDetails === "AI analysis unavailable" || manipulationDetails === "AI sentiment analysis unavailable") {
                manipulationDetails = this._generateFallbackDetails(uniqueTraders, volume24h, volumePerTrader, level, triggerReason);
            }

            return {
                volume_manipulation_score: score,
                volume_manipulation_level: level,
                unique_traders: uniqueTraders,
                volume_per_trader: Math.round(volumePerTrader),
                transactions_24h: transactions24h,
                wash_trade_score_external: washTradeScore,
                manipulation_details: manipulationDetails,
                trigger_reason: triggerReason,
                weight: this.weight
            };
        } catch (error) {
            console.error(`[VolumeManipulationDetector] Error: ${error.message}`);
            return {
                volume_manipulation_score: 50,
                volume_manipulation_level: "UNKNOWN",
                unique_traders: 0,
                volume_per_trader: 0,
                transactions_24h: 0,
                wash_trade_score_external: 0,
                manipulation_details: `Analysis failed: ${error.message}. Defaulting to neutral score.`,
                trigger_reason: "Error during analysis",
                weight: this.weight
            };
        }
    }

    /**
     * Generates a deterministic fallback summary when LLM is unavailable.
     * @private
     * @param {number} traders - Unique trader count
     * @param {number} volume - 24h volume in USD
     * @param {number} volPerTrader - Volume per trader in USD
     * @param {string} level - Calculated risk level
     * @param {string} trigger - The rule that triggered the score
     * @returns {string} Human-readable manipulation details
     */
    _generateFallbackDetails(traders, volume, volPerTrader, level, trigger) {
        if (level === "VERY_HIGH") {
            return `CRITICAL: ${trigger}. With only ${traders} unique traders generating $${volume.toLocaleString()} in 24h volume ($${Math.round(volPerTrader).toLocaleString()}/trader), this token exhibits strong wash trading signals. Extreme caution advised.`;
        } else if (level === "HIGH") {
            return `WARNING: ${trigger}. Volume per trader of $${Math.round(volPerTrader).toLocaleString()} across ${traders} traders is significantly above normal levels. High probability of artificial volume inflation.`;
        } else if (level === "MEDIUM") {
            return `MODERATE: ${trigger}. Volume distribution across ${traders} traders shows elevated concentration. Some wash trading may be present but not conclusive.`;
        }
        return `LOW RISK: Volume of $${volume.toLocaleString()} across ${traders} unique traders appears organic. Volume per trader ($${Math.round(volPerTrader).toLocaleString()}) is within normal range.`;
    }
}

// Export for Eliza framework / module inclusion
module.exports = VolumeManipulationDetector;
