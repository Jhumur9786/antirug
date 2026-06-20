/**
 * LiquidityShockAgent — Tracks liquidity changes over time for AntiRug.
 *
 * Monitors a token's USD liquidity depth across 1h, 6h, and 24h windows.
 * Large sudden drops ("liquidity shocks") are a leading indicator of rug
 * pulls, as creators or insiders drain pools before dumping.
 *
 * Storage: snapshots are persisted to a local JSON file rather than SQLite
 * for portability and zero-dependency operation.
 *
 * Weight in the final risk formula: 10% (liquidity intelligence category).
 *
 * @module LiquidityShockAgent
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const askLLM = require('./llmClient');

/** Default path for the liquidity history JSON store. */
const DEFAULT_HISTORY_PATH = path.join(__dirname, 'liquidity_history.json');

/** DexScreener pairs API base URL. */
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

class LiquidityShockAgent {
    /**
     * @param {Object} [options]
     * @param {string} [options.historyPath] - Override the default JSON history file location.
     */
    constructor(options = {}) {
        this.historyPath = options.historyPath || DEFAULT_HISTORY_PATH;
    }

    /**
     * Analyse liquidity shock risk for a given token.
     *
     * @param {Object} data
     * @param {string} data.token_id      - Solana token mint address.
     * @param {number} [data.liquidity_usd] - Current liquidity (USD), fetched live if omitted.
     * @returns {Promise<Object>} Shock analysis result.
     * @returns {number}   result.liquidity_shock_score  - 0-95 risk score.
     * @returns {string}   result.liquidity_shock_level  - NONE | LOW | MEDIUM | HIGH | CRITICAL.
     * @returns {number|null} result.liquidity_change_1h  - % change in last 1h (null if no data).
     * @returns {number|null} result.liquidity_change_6h  - % change in last 6h (null if no data).
     * @returns {number|null} result.liquidity_change_24h - % change in last 24h (null if no data).
     * @returns {string[]} result.shock_details          - Human-readable shock descriptions.
     * @returns {string}   result.analysis_mode          - DETERMINISTIC_ONLY | HYBRID_AI.
     */
    async analyze(data) {
        try {
            const tokenId = data.token_id;
            if (!tokenId) {
                throw new Error('token_id is required for liquidity shock analysis');
            }

            // 1. Resolve current liquidity ────────────────────────────
            let currentLiquidity = data.liquidity_usd;
            if (currentLiquidity === undefined || currentLiquidity === null) {
                currentLiquidity = await this._fetchLiveLiquidity(tokenId);
            }

            // 2. Load historical snapshots ────────────────────────────
            const history = this._loadHistory();
            const tokenHistory = history[tokenId] || [];

            // 3. Store the new snapshot ───────────────────────────────
            this._storeLiquiditySnapshot(tokenId, currentLiquidity);

            // 4. If this is the first scan, we have no baseline ───────
            if (tokenHistory.length === 0) {
                return this._buildResult({
                    score: 10,
                    level: 'NONE',
                    change1h: null,
                    change6h: null,
                    change24h: null,
                    details: ['First scan — baseline recorded, no historical comparison available'],
                    currentLiquidity,
                    analysisMode: 'DETERMINISTIC_ONLY'
                });
            }

            // 5. Calculate percentage changes over windows ────────────
            const now = Date.now();
            const change1h = this._percentageChange(tokenHistory, now, 1);
            const change6h = this._percentageChange(tokenHistory, now, 6);
            const change24h = this._percentageChange(tokenHistory, now, 24);

            // 6. Calculate shock score ────────────────────────────────
            const { score, details } = this._calculateShockScore(change1h, change6h, change24h);

            // 7. Resolve shock level ──────────────────────────────────
            const level = this._resolveShockLevel(score);

            // 8. Optional LLM enhancement for severe shocks ──────────
            let analysisMode = 'DETERMINISTIC_ONLY';
            let llmSummary = null;
            if (score >= 40) {
                try {
                    const prompt = `You are a DeFi liquidity analyst.
A Solana token (${tokenId}) shows these liquidity changes:
- 1h change: ${change1h !== null ? change1h.toFixed(1) + '%' : 'N/A'}
- 6h change: ${change6h !== null ? change6h.toFixed(1) + '%' : 'N/A'}
- 24h change: ${change24h !== null ? change24h.toFixed(1) + '%' : 'N/A'}
- Current liquidity: $${currentLiquidity.toLocaleString()}
- Shock score: ${score}/95

In 1-2 sentences, explain the liquidity risk. Return only plain text, no JSON.`;

                    const response = await askLLM(prompt, { max_tokens: 150, temperature: 0.2 });
                    if (response && !response.includes('unavailable')) {
                        llmSummary = response.trim();
                        analysisMode = 'HYBRID_AI';
                    }
                } catch (_) {
                    // Silently fall back to deterministic
                }
            }

            const result = this._buildResult({
                score,
                level,
                change1h,
                change6h,
                change24h,
                details,
                currentLiquidity,
                analysisMode
            });

            if (llmSummary) {
                result.ai_liquidity_summary = llmSummary;
            }

            return result;

        } catch (error) {
            console.error('[LiquidityShockAgent] Analysis failed:', error.message);
            // Graceful fallback — return a neutral score so the pipeline never breaks
            return this._buildResult({
                score: 50,
                level: 'MEDIUM',
                change1h: null,
                change6h: null,
                change24h: null,
                details: [`Analysis error: ${error.message}`],
                currentLiquidity: data.liquidity_usd || 0,
                analysisMode: 'DETERMINISTIC_ONLY'
            });
        }
    }

    // ── Private helpers ──────────────────────────────────────────────

    /**
     * Fetch live liquidity from DexScreener for a Solana token.
     *
     * @param {string} tokenId - Token mint address.
     * @returns {Promise<number>} Liquidity in USD, or 0 on failure.
     * @private
     */
    async _fetchLiveLiquidity(tokenId) {
        try {
            const url = `${DEXSCREENER_API}/${tokenId}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`[LiquidityShockAgent] DexScreener returned ${response.status}`);
                return 0;
            }
            const json = await response.json();
            // Pick the pair with the highest liquidity
            const pairs = json.pairs || [];
            if (pairs.length === 0) return 0;

            let maxLiquidity = 0;
            for (const pair of pairs) {
                const liq = pair.liquidity?.usd || 0;
                if (liq > maxLiquidity) maxLiquidity = liq;
            }
            return maxLiquidity;
        } catch (error) {
            console.warn('[LiquidityShockAgent] Failed to fetch live liquidity:', error.message);
            return 0;
        }
    }

    /**
     * Load the full history object from the JSON file.
     * Returns an empty object if the file doesn't exist or is corrupt.
     *
     * @returns {Object<string, Array<{timestamp: number, liquidity_usd: number}>>}
     * @private
     */
    _loadHistory() {
        try {
            if (!fs.existsSync(this.historyPath)) return {};
            const raw = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(raw);
        } catch (_) {
            return {};
        }
    }

    /**
     * Persist a liquidity snapshot for a token.
     * Keeps at most 168 snapshots per token (~7 days of hourly data).
     *
     * @param {string} tokenId      - Token mint address.
     * @param {number} liquidityUsd - Current liquidity in USD.
     * @private
     */
    _storeLiquiditySnapshot(tokenId, liquidityUsd) {
        try {
            const history = this._loadHistory();
            if (!history[tokenId]) history[tokenId] = [];

            history[tokenId].push({
                timestamp: Date.now(),
                liquidity_usd: liquidityUsd
            });

            // Cap at 168 entries per token (7 days × 24h)
            const MAX_SNAPSHOTS = 168;
            if (history[tokenId].length > MAX_SNAPSHOTS) {
                history[tokenId] = history[tokenId].slice(-MAX_SNAPSHOTS);
            }

            fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
        } catch (error) {
            console.warn('[LiquidityShockAgent] Failed to store snapshot:', error.message);
        }
    }

    /**
     * Calculate the percentage change in liquidity over a given window.
     *
     * @param {Array<{timestamp: number, liquidity_usd: number}>} snapshots
     * @param {number} now         - Current timestamp (ms).
     * @param {number} windowHours - How far back to look (hours).
     * @returns {number|null} Percentage change (negative = drop), or null if no data in window.
     * @private
     */
    _percentageChange(snapshots, now, windowHours) {
        const windowMs = windowHours * 60 * 60 * 1000;
        const cutoff = now - windowMs;

        // Find the snapshot closest to (but not after) the cutoff
        let closest = null;
        let closestDiff = Infinity;
        for (const snap of snapshots) {
            const diff = Math.abs(snap.timestamp - cutoff);
            if (diff < closestDiff) {
                closestDiff = diff;
                closest = snap;
            }
        }

        if (!closest) return null;

        // Only use if the closest snapshot is within ±50% of the window size
        // (e.g. for a 1h window, snapshot must be within 30 minutes of the target)
        const toleranceMs = windowMs * 0.5;
        if (closestDiff > toleranceMs) return null;

        const oldLiq = closest.liquidity_usd;
        if (oldLiq === 0) return null;

        // Latest snapshot (most recent stored)
        const latest = snapshots[snapshots.length - 1];
        const newLiq = latest.liquidity_usd;

        return ((newLiq - oldLiq) / oldLiq) * 100;
    }

    /**
     * Calculate the shock score and generate detail strings.
     *
     * Base score: 10 (safe). Penalties are additive. Clamped to 0-95.
     *
     * Penalty rules:
     *   - Liquidity drop ≥70% in 1h  → +60
     *   - Liquidity drop ≥40% in 6h  → +30
     *   - Liquidity drop ≥20% in 24h → +15
     *
     * @param {number|null} change1h
     * @param {number|null} change6h
     * @param {number|null} change24h
     * @returns {{ score: number, details: string[] }}
     * @private
     */
    _calculateShockScore(change1h, change6h, change24h) {
        let score = 10; // base — no shock
        const details = [];

        // 1h window: catastrophic drain
        if (change1h !== null && change1h <= -70) {
            score += 60;
            details.push(`Catastrophic 1h liquidity drop: ${change1h.toFixed(1)}% (penalty +60)`);
        }

        // 6h window: significant drain
        if (change6h !== null && change6h <= -40) {
            score += 30;
            details.push(`Significant 6h liquidity drop: ${change6h.toFixed(1)}% (penalty +30)`);
        }

        // 24h window: moderate drain
        if (change24h !== null && change24h <= -20) {
            score += 15;
            details.push(`Moderate 24h liquidity drop: ${change24h.toFixed(1)}% (penalty +15)`);
        }

        if (details.length === 0) {
            details.push('No significant liquidity shocks detected');
        }

        // Clamp to 0-95
        score = Math.max(0, Math.min(95, score));

        return { score, details };
    }

    /**
     * Map a numeric shock score to a human-readable severity level.
     *
     * @param {number} score - 0-95 shock score.
     * @returns {string} NONE | LOW | MEDIUM | HIGH | CRITICAL
     * @private
     */
    _resolveShockLevel(score) {
        if (score >= 70) return 'CRITICAL';
        if (score >= 50) return 'HIGH';
        if (score >= 30) return 'MEDIUM';
        if (score >= 15) return 'LOW';
        return 'NONE';
    }

    /**
     * Construct a standardised result object.
     *
     * @param {Object} params
     * @returns {Object} The analysis result.
     * @private
     */
    _buildResult({ score, level, change1h, change6h, change24h, details, currentLiquidity, analysisMode }) {
        return {
            liquidity_shock_score: score,
            liquidity_shock_level: level,
            liquidity_change_1h: change1h,
            liquidity_change_6h: change6h,
            liquidity_change_24h: change24h,
            current_liquidity_usd: currentLiquidity,
            shock_details: details,
            analysis_mode: analysisMode
        };
    }
}

module.exports = LiquidityShockAgent;
