/**
 * AuthorityRiskEngine
 * Framework: Eliza
 * Language: JavaScript (Node.js)
 *
 * Purpose: Evaluates Solana token authority configuration (mint, freeze,
 * update) and calculates a weighted composite authority risk score.
 * Active authorities are dangerous because they allow the deployer to
 * manipulate supply, freeze holders, or change token metadata.
 *
 * Weight breakdown:
 *   - Mint authority:   8% of overall composite
 *   - Freeze authority: 5% of overall composite
 *   - Update authority: 6% of overall composite
 *   - Total:           19%
 *
 * Expected scanner data fields:
 *   - mint_authority_active {boolean}   — Whether mint authority is still active
 *   - freeze_authority_active {boolean} — Whether freeze authority is still active
 *   - update_authority_active {boolean} — Whether update authority is still active
 *   - is_multisig {boolean}             — Whether authority is behind a multi-sig wallet
 */

const askLLM = require("./llmClient");

class AuthorityRiskEngine {
    constructor() {
        this.name = "AuthorityRiskEngine";
        this.description = "Evaluates Solana token authority risks (mint, freeze, update) with multi-sig discounting.";

        /**
         * Individual authority weights as fractions of the overall composite.
         * These are used to combine the three authority scores into one.
         */
        this.AUTHORITY_WEIGHTS = {
            mint: 0.08,
            freeze: 0.05,
            update: 0.06
        };

        /** Combined weight of this engine in the global risk composite. */
        this.weight = 0.19;

        /**
         * Base risk scores for authority states.
         * Active = deployer retains dangerous control.
         * Renounced = authority has been permanently disabled.
         */
        this.SCORES = {
            ACTIVE: 90,
            RENOUNCED: 5
        };

        /**
         * Multi-sig discount factor.
         * Active authorities behind a multi-sig are 30% less risky
         * because no single actor can exploit them unilaterally.
         */
        this.MULTISIG_DISCOUNT = 0.30;
    }

    /**
     * Analyzes token authority data and returns a composite risk assessment.
     * @param {Object} scannerData - Structured authority data from the token scanner
     * @returns {Object} Authority risk analysis result
     */
    async analyze(scannerData) {
        if (!scannerData || typeof scannerData !== "object") {
            throw new Error("Invalid or missing scanner data.");
        }

        console.log(`[${this.name}] Evaluating token authorities...`);

        try {
            const isMultisig = scannerData.is_multisig === true;

            // Score each authority independently
            const mintRisk = this._scoreAuthority(scannerData.mint_authority_active, isMultisig);
            const freezeRisk = this._scoreAuthority(scannerData.freeze_authority_active, isMultisig);
            const updateRisk = this._scoreAuthority(scannerData.update_authority_active, isMultisig);

            // Weighted combination (normalized to the engine's own weight scope)
            const totalWeight = this.AUTHORITY_WEIGHTS.mint + this.AUTHORITY_WEIGHTS.freeze + this.AUTHORITY_WEIGHTS.update;
            const compositeScore = Math.round(
                (mintRisk * this.AUTHORITY_WEIGHTS.mint
                    + freezeRisk * this.AUTHORITY_WEIGHTS.freeze
                    + updateRisk * this.AUTHORITY_WEIGHTS.update)
                / totalWeight
            );

            // Generate detailed explanation
            const details = await this._generateDetails(scannerData, {
                mintRisk, freezeRisk, updateRisk, compositeScore, isMultisig
            });

            console.log(`[${this.name}] Composite authority score: ${compositeScore} (mint=${mintRisk}, freeze=${freezeRisk}, update=${updateRisk})`);

            return {
                authority_risk_score: compositeScore,
                mint_risk: mintRisk,
                freeze_risk: freezeRisk,
                update_risk: updateRisk,
                authority_details: details,
                weight: this.weight
            };
        } catch (error) {
            console.error(`[${this.name}] Analysis failed: ${error.message}`);

            // Graceful fallback — assume worst case on failure
            return {
                authority_risk_score: this.SCORES.ACTIVE,
                mint_risk: this.SCORES.ACTIVE,
                freeze_risk: this.SCORES.ACTIVE,
                update_risk: this.SCORES.ACTIVE,
                authority_details: "Authority analysis failed — defaulting to high risk.",
                weight: this.weight
            };
        }
    }

    /**
     * Scores a single authority based on its active/renounced state
     * and whether multi-sig protection is in place.
     * @private
     * @param {boolean} isActive - Whether the authority is still active
     * @param {boolean} isMultisig - Whether multi-sig governance is enabled
     * @returns {number} Risk score for this authority (0-100)
     */
    _scoreAuthority(isActive, isMultisig) {
        if (isActive !== true) {
            return this.SCORES.RENOUNCED;
        }

        // Active authority — apply multi-sig discount if applicable
        const baseScore = this.SCORES.ACTIVE;
        if (isMultisig) {
            return Math.round(baseScore * (1 - this.MULTISIG_DISCOUNT));
        }

        return baseScore;
    }

    /**
     * Generates a human-readable detail string using the LLM.
     * Falls back to a static description if LLM is unavailable.
     * @private
     * @param {Object} data - Scanner data
     * @param {Object} scores - Computed scores breakdown
     * @returns {Promise<string>} Detailed analysis text
     */
    async _generateDetails(data, scores) {
        const mintStatus = data.mint_authority_active ? "ACTIVE" : "RENOUNCED";
        const freezeStatus = data.freeze_authority_active ? "ACTIVE" : "RENOUNCED";
        const updateStatus = data.update_authority_active ? "ACTIVE" : "RENOUNCED";
        const multisigLabel = scores.isMultisig ? "Yes (30% discount applied)" : "No";

        const staticDetail = `Mint authority: ${mintStatus} (score: ${scores.mintRisk}). `
            + `Freeze authority: ${freezeStatus} (score: ${scores.freezeRisk}). `
            + `Update authority: ${updateStatus} (score: ${scores.updateRisk}). `
            + `Multi-sig: ${multisigLabel}. `
            + `Composite authority risk: ${scores.compositeScore}/100.`;

        try {
            const prompt = `Analyze these Solana token authority settings and provide a 2-sentence risk assessment:\n`
                + `Mint Authority: ${mintStatus} (risk: ${scores.mintRisk})\n`
                + `Freeze Authority: ${freezeStatus} (risk: ${scores.freezeRisk})\n`
                + `Update Authority: ${updateStatus} (risk: ${scores.updateRisk})\n`
                + `Multi-sig Governance: ${scores.isMultisig ? "Enabled" : "Disabled"}\n`
                + `Composite Risk: ${scores.compositeScore}/100`;

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
module.exports = AuthorityRiskEngine;
