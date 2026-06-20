/**
 * CriticalOverrideEngine — Post-score hard floor rules for AntiRug.
 *
 * Applied AFTER the weighted risk formula. These overrides enforce minimum
 * risk floors when critical on-chain signals are detected, preventing the
 * scoring system from ever labelling a clearly dangerous token as safe.
 *
 * Each rule inspects specific fields from module results and, if triggered,
 * bumps `finalRisk` up to a minimum floor.  Multiple overrides can stack
 * (the highest floor wins because we use `Math.max`).
 *
 * @module CriticalOverrideEngine
 * @version 1.0.0
 */

class CriticalOverrideEngine {
    /**
     * Evaluate hard-floor override rules against the weighted risk score.
     *
     * @param {number} originalScore - The weighted risk score (0-100) from RiskScoringAgent.
     * @param {Object} moduleResults - Aggregated outputs from all analysis modules.
     * @param {Object} [moduleResults.insider]        - InsiderWalletScorer output.
     * @param {boolean} [moduleResults.insider.creator_fully_exited] - Whether the creator wallet has sold 100%.
     * @param {Object} [moduleResults.lpLock]          - LPLockAnalyzer output.
     * @param {string} [moduleResults.lpLock.lp_lock_status] - 'LOCKED' | 'UNLOCKED' | 'PARTIAL'.
     * @param {number} [moduleResults.liquidity_usd]   - Current USD liquidity depth.
     * @param {Object} [moduleResults.bundler]         - BundlerDetector output.
     * @param {number} [moduleResults.bundler.bundled_supply_pct] - % of supply in bundled wallets.
     * @param {Object} [moduleResults.walletGraph]     - WalletGraph output.
     * @param {number} [moduleResults.walletGraph.creator_linked_holders_pct] - % supply in creator-linked wallets.
     * @param {Object} [moduleResults.authority]       - AuthorityRiskEngine output.
     * @param {boolean} [moduleResults.authority.mint_authority_active]   - Mint authority still enabled.
     * @param {boolean} [moduleResults.authority.freeze_authority_active] - Freeze authority still enabled.
     * @param {boolean} [moduleResults.authority.update_authority_active] - Update authority still enabled.
     * @param {Object} [moduleResults.scanner]         - TokenScannerAgent output.
     * @param {number} [moduleResults.scanner.top_holder_percentage] - % held by top holder.
     *
     * @returns {Object} Override result.
     * @returns {number}   result.original_score    - The score that was passed in.
     * @returns {number}   result.final_score       - The score after overrides (>= original).
     * @returns {boolean}  result.override_applied  - Whether any override fired.
     * @returns {string[]} result.override_reasons   - Human-readable reasons for each override.
     * @returns {number}   result.override_count     - Number of overrides that fired.
     */
    analyze(originalScore, moduleResults) {
        let finalRisk = originalScore;
        const overrides = [];

        // Safely default moduleResults to an empty object
        const m = moduleResults || {};

        const s = m.scanner || {};
        const auth = m.authority || {};
        const lp = m.lpLock || {};
        const graph = m.walletGraph || {};
        const bundler = m.bundler || {};
        const insider = m.insider || {};

        // 1. Creator fully exited (floor 95)
        const creatorExited = insider.creator_status === "FULLY_EXITED" || s.creator_fully_exited === true;
        if (creatorExited) {
            overrides.push("Creator has fully exited");
            finalRisk = Math.max(finalRisk, 95);
        }

        // 2. Active Mint Authority & Supply Growth Detected (floor 95)
        const mintAuthorityActive = auth.mint_risk === 90 || s.mint_authority_active || s.supply_key_exists || false;
        const supplyGrowthDetected = s.supply_growth_detected || s.supply_grown || false;
        if (mintAuthorityActive && supplyGrowthDetected) {
            overrides.push("Active mint authority + supply growth detected");
            finalRisk = Math.max(finalRisk, 95);
        }

        // 3. LP unlocked with low liquidity (< $100k) (floor 90)
        const lpUnlocked = lp.lp_lock_status === "UNLOCKED" || (!s.lp_locked && !s.lp_burned);
        const liquidityUsd = typeof s.liquidity_usd === "number" ? s.liquidity_usd : 0;
        if (lpUnlocked && liquidityUsd > 0 && liquidityUsd < 100000) {
            overrides.push("LP unlocked with low liquidity (< $100k)");
            finalRisk = Math.max(finalRisk, 90);
        }

        // 4. Insider Cluster Supply > 40% (floor 95)
        const maxClusterPct = Math.max(
            graph.max_cluster_supply_pct || 0,
            graph.creator_linked_holders_pct || 0,
            s.max_cluster_supply_pct || 0,
            s.creator_linked_holders_pct || 0
        );
        if (maxClusterPct > 40) {
            overrides.push(`Insider wallet cluster controls ${maxClusterPct.toFixed(1)}% of supply (>40%)`);
            finalRisk = Math.max(finalRisk, 95);
        }

        // 5. Coordinated Bundled Supply > 60% (floor 90)
        const bundledSupplyPct = Math.max(
            bundler.bundled_supply_pct || 0,
            s.bundled_supply_pct || 0
        );
        if (bundledSupplyPct > 60) {
            overrides.push(`Coordinated bundled wallets hold ${bundledSupplyPct.toFixed(1)}% of supply (>60%)`);
            finalRisk = Math.max(finalRisk, 90);
        }

        // 6. Active Freeze Authority (floor 85)
        const freezeAuthorityActive = auth.freeze_risk === 90 || s.freeze_authority_active || s.freeze_key_exists || false;
        if (freezeAuthorityActive) {
            overrides.push("Active freeze authority");
            finalRisk = Math.max(finalRisk, 85);
        }

        finalRisk = Math.min(100, Math.round(finalRisk));

        return {
            original_score: originalScore,
            final_score: finalRisk,
            override_applied: overrides.length > 0,
            override_reasons: overrides,
            override_count: overrides.length
        };
    }
}

module.exports = CriticalOverrideEngine;
