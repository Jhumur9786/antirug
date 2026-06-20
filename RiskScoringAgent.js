const askLLM = require("./llmClient");
const CriticalOverrideEngine = require("./CriticalOverrideEngine");
const deployerDB = require("./DeployerReputationDatabase");

class RiskScoringAgent {
    constructor() {
        this.overrideEngine = new CriticalOverrideEngine();
    }

    /**
     * Fuses data from multiple agents into a professional security report.
     * 
     * @param {Object} input - Object containing outputs from all modules
     * @returns {Object} Professional security analysis JSON
     */
    async calculateRisk({ 
        scanner, 
        blockchain, 
        sentiment,
        authority,
        lpLock,
        bundler,
        insider,
        sniper,
        smartMoney,
        walletGraph,
        liquidityShock,
        volumeManipulation
    }) {
        if (!scanner) {
            throw new Error("Missing required input: scanner data is required.");
        }

        // Aggregate all module results for override engine
        const moduleResults = {
            scanner, blockchain, sentiment, authority, lpLock, bundler,
            insider, sniper, smartMoney, walletGraph, liquidityShock, volumeManipulation
        };

        const deterministic = this._calculateDeterministic(moduleResults);

        let analysis_mode = "HYBRID_AI";
        let ai_risk_summary = "";
        let ai_confidence_reasoning = "";
        let ai_recommendations = [];

        try {
            const prompt = `You are a blockchain security risk analyst specializing in Solana.
Explain why this token has this risk score.
Use only provided data. Do not invent information.
Limit to 2-3 sentences. Focus on the most critical red flags (insider exits, bundlers, unlocked LP).

Data:
Score: ${deterministic.final_risk_score}
Level: ${deterministic.risk_level}
Primary Risk: ${deterministic.primary_risk_factor}
Top Risks: ${deterministic.top_risk_factors.join(", ")}
Overrides Applied: ${deterministic.overrides.join(", ")}
Confidence: ${deterministic.confidence_tier}

Return strictly JSON with:
{
  "ai_risk_summary": "Professional security explanation. Why it has this score, what drives it. 2-3 sentences.",
  "ai_confidence_reasoning": "Reasoning why confidence is high or low.",
  "ai_recommendations": ["Rec 1", "Rec 2", "Rec 3"]
}`;

            let rawResponse = await askLLM(prompt, { response_format: { type: "json_object" }, max_tokens: 800 });
            rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            const start = rawResponse.indexOf('{');
            const end = rawResponse.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                rawResponse = rawResponse.substring(start, end + 1);
            }
            const aiData = JSON.parse(rawResponse);

            ai_risk_summary = aiData.ai_risk_summary;
            ai_confidence_reasoning = aiData.ai_confidence_reasoning;
            ai_recommendations = Array.isArray(aiData.ai_recommendations) 
                ? aiData.ai_recommendations.slice(0, 3) 
                : ["Monitor token activity"];
                
        } catch (error) {
            analysis_mode = "DETERMINISTIC_ONLY";
            ai_risk_summary = "AI analysis unavailable – deterministic risk fusion applied.";
            ai_confidence_reasoning = "Confidence derived from deterministic scoring.";
            ai_recommendations = ["Monitor token activity"];
        }

        return {
            scoring_version: deterministic.scoring_version,
            final_risk_score: deterministic.final_risk_score,
            original_score: deterministic.original_score,
            risk_level: deterministic.risk_level,
            primary_risk_factor: deterministic.primary_risk_factor,
            top_risk_factors: deterministic.top_risk_factors,
            risk_breakdown: deterministic.risk_breakdown,
            overrides_applied: deterministic.overrides,
            confidence_score: deterministic.confidence_score,
            confidence_tier: deterministic.confidence_tier,
            analysis_mode,
            ai_risk_summary,
            ai_confidence_reasoning,
            ai_recommendations,
            // Backward compatibility
            rug_risk_score: deterministic.final_risk_score,
            risk_flags: deterministic.top_risk_factors,
            recommendations: ai_recommendations
        };
    }

    _calculateDeterministic(modules) {
        const s = modules.scanner || {};
        const blockchain = modules.blockchain || {};
        const sentiment = modules.sentiment || {};
        const auth = modules.authority || {};
        const lp = modules.lpLock || {};
        const bundler = modules.bundler || {};
        const insider = modules.insider || {};
        const sniper = modules.sniper || {};
        const smartMoney = modules.smartMoney || {};
        const graph = modules.walletGraph || {};
        const liqShock = modules.liquidityShock || {};
        const volManip = modules.volumeManipulation || {};

        // 1. Layer 1: Token Security (15% Weight)
        let authScore = 50;
        if (auth.authority_risk_score !== undefined) {
            authScore = auth.authority_risk_score;
        } else {
            const mintActive = s.mint_authority_active || s.supply_key_exists || false;
            const freezeActive = s.freeze_authority_active || s.freeze_key_exists || false;
            const updateActive = s.update_authority_active || s.metadata_is_mutable || false;
            const authPoints = (mintActive ? 25 : 0) + (freezeActive ? 20 : 0) + (updateActive ? 10 : 0);
            authScore = Math.round(authPoints * (100 / 55));
        }

        let ageScore = 50;
        if (blockchain.age_risk_score !== undefined) {
            ageScore = blockchain.age_risk_score;
        } else {
            const ageDays = s.token_age_days || 0;
            if (ageDays < 1) ageScore = 95;
            else if (ageDays < 7) ageScore = 80;
            else if (ageDays < 30) ageScore = 50;
            else if (ageDays < 180) ageScore = 20;
            else ageScore = 10;
        }
        const layer1Score = Math.round((authScore * 19 / 23) + (ageScore * 4 / 23));

        // 2. Layer 2: Liquidity Intelligence (20% Weight)
        let lpLockScore = 50;
        if (lp.lp_lock_risk_score !== undefined) {
            lpLockScore = lp.lp_lock_risk_score;
        } else {
            const lpLocked = s.lp_locked || false;
            const lpBurned = s.lp_burned || false;
            const lockDays = s.lock_duration_days || 0;
            lpLockScore = (!lpLocked && !lpBurned) ? 95 : ((lpLocked && lockDays < 90) ? 70 : ((lpLocked && lockDays <= 365) ? 40 : 15));
        }
        const liqShockScore = liqShock.liquidity_shock_score !== undefined ? liqShock.liquidity_shock_score : 10;
        const layer2Score = Math.round((lpLockScore * 12 / 20) + (liqShockScore * 8 / 20));

        // 3. Layer 3: Holder Intelligence (15% Weight)
        let giniScore = 50;
        const holders = s.holders || [];
        if (holders.length > 0) {
            const balances = holders.map(h => h.balance).filter(b => b > 0);
            if (balances.length > 1) {
                balances.sort((a, b) => a - b);
                const n = balances.length;
                let diffSum = 0;
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        diffSum += Math.abs(balances[i] - balances[j]);
                    }
                }
                const sum = balances.reduce((a, b) => a + b, 0);
                if (sum > 0) {
                    const mean = sum / n;
                    const giniVal = diffSum / (2 * n * n * mean);
                    giniScore = giniVal >= 0.85 ? 95 : (giniVal >= 0.70 ? 70 : (giniVal >= 0.50 ? 40 : 15));
                }
            }
        }
        let concScore = 50;
        if (blockchain.holder_concentration_score !== undefined) {
            concScore = blockchain.holder_concentration_score;
        } else {
            const topHolderPct = s.top_holder_percentage || 0;
            const top5HolderPct = s.top_5_holder_percentage || 0;
            if (topHolderPct > 50 || top5HolderPct > 70) concScore = 95;
            else if (topHolderPct >= 20 || top5HolderPct >= 40) concScore = 50;
            else concScore = 20;
        }
        const layer3Score = Math.round((giniScore + concScore) / 2);

        // 4. Layer 4: Wallet Intelligence (20% Weight)
        let graphScore = 50;
        if (graph.wallet_graph_risk_score !== undefined) {
            graphScore = graph.wallet_graph_risk_score;
        } else {
            const creatorLinkedPct = s.creator_linked_holders_pct || 0;
            const maxClusterSupplyPct = s.max_cluster_supply_pct || 0;
            if (creatorLinkedPct > 40) graphScore = 95;
            else if (maxClusterSupplyPct > 50) graphScore = 90;
            else if (maxClusterSupplyPct > 30) graphScore = 70;
            else if (maxClusterSupplyPct > 15) graphScore = 50;
            else graphScore = 15;
        }
        const smartMoneyScore = smartMoney.smart_money_score !== undefined ? smartMoney.smart_money_score : 50;
        const layer4Score = Math.round((graphScore * 18 / 20) + (smartMoneyScore * 2 / 20));

        // 5. Layer 5: Launch Intelligence (10% Weight)
        let bundlerScore = 50;
        if (bundler.bundler_risk_score !== undefined) {
            bundlerScore = bundler.bundler_risk_score;
        } else {
            const bundlePct = s.bundled_supply_pct || 0;
            bundlerScore = bundlePct > 50 ? 90 : (bundlePct >= 30 ? 70 : (bundlePct >= 15 ? 50 : 15));
        }
        let sniperScore = 50;
        if (sniper.sniper_risk_score !== undefined) {
            sniperScore = sniper.sniper_risk_score;
        } else {
            const sniperPct = s.sniper_supply_pct || 0;
            sniperScore = sniperPct > 40 ? 85 : (sniperPct >= 25 ? 65 : (sniperPct >= 10 ? 40 : 15));
        }
        const layer5Score = Math.round((bundlerScore * 6 / 10) + (sniperScore * 4 / 10));

        // 6. Layer 6: Developer Trust (10% Weight)
        let insiderScore = 50;
        if (insider.insider_risk_score !== undefined) {
            insiderScore = insider.insider_risk_score;
        } else {
            const soldPct = s.creator_sold_pct || 0;
            if (s.creator_fully_exited) insiderScore = 95;
            else if (soldPct >= 80) insiderScore = 80;
            else if (soldPct >= 10) insiderScore = 50;
            else insiderScore = 10;
        }
        let deployerRepRisk = 50;
        if (s.creator_wallet) {
            const creatorRep = deployerDB.getReputation(s.creator_wallet);
            if (creatorRep && creatorRep.deployer_risk_score !== undefined) {
                deployerRepRisk = creatorRep.deployer_risk_score;
            }
        }
        const layer6Score = Math.round((insiderScore * 6 / 10) + (deployerRepRisk * 4 / 10));

        // 7. Layer 7: Market Manipulation (5% Weight)
        let volManipScore = 50;
        if (volManip.volume_manipulation_score !== undefined) {
            volManipScore = volManip.volume_manipulation_score;
        } else {
            const washScore = s.wash_trade_score || 0;
            volManipScore = washScore > 50 ? washScore : 15;
        }
        const layer7Score = volManipScore;

        // 8. Layer 8: Social Intelligence (5% Weight)
        const sentimentScore = sentiment.community_risk_index !== undefined ? sentiment.community_risk_index : 50;
        const layer8Score = sentimentScore;

        // Final Raw Score Calculation (Modular 8-Layer Weights)
        let finalScoreRaw = 
            (layer1Score * 0.15) +
            (layer2Score * 0.20) +
            (layer3Score * 0.15) +
            (layer4Score * 0.20) +
            (layer5Score * 0.10) +
            (layer6Score * 0.10) +
            (layer7Score * 0.05) +
            (layer8Score * 0.05);

        finalScoreRaw = Math.max(0, Math.min(100, Math.round(finalScoreRaw)));

        // Apply Critical Overrides
        const overrideResult = this.overrideEngine.analyze(finalScoreRaw, modules);
        const finalScore = overrideResult.final_score;

        // Map to 5-Tier rating scale
        let riskLevel = "SAFE";
        if (finalScore >= 81) riskLevel = "EXTREME RISK";
        else if (finalScore >= 61) riskLevel = "HIGH RISK";
        else if (finalScore >= 41) riskLevel = "CAUTION";
        else if (finalScore >= 21) riskLevel = "LOW RISK";

        // Primary Risk Factor Identification
        const factors = [
            { label: "Token Security Risk", score: layer1Score },
            { label: "Liquidity Safety Risk", score: layer2Score },
            { label: "Holder Concentration Risk", score: layer3Score },
            { label: "Coordinated Wallet Risk", score: layer4Score },
            { label: "Launch Exploitation Risk", score: layer5Score },
            { label: "Developer History Risk", score: layer6Score },
            { label: "Market Manipulation Risk", score: layer7Score },
            { label: "Social Sentiment Risk", score: layer8Score }
        ];

        factors.sort((a, b) => b.score - a.score);

        const primary_risk_factor = overrideResult.override_applied && overrideResult.override_reasons.length > 0 
            ? overrideResult.override_reasons[0] 
            : (factors[0].score > 60 ? factors[0].label : "Minimal structural risk");
            
        const top_risk_factors = factors.slice(0, 3).map(f => f.label);

        // Confidence Engine 2.0
        const rpcDataIntegrity = s.token_id ? 30 : 15;
        const walletGraphDepth = graph.wallet_graph_risk_score !== undefined ? 30 : 15;
        const liquidityHistory = (liqShock.liquidity_change_1h !== undefined && liqShock.liquidity_change_1h !== null) ? 20 : 10;
        const socialCoverage = (sentiment.data_sources_used && sentiment.data_sources_used.length > 0) ? 20 : 10;
        
        const confidence_score = rpcDataIntegrity + walletGraphDepth + liquidityHistory + socialCoverage;

        let confidence_tier = "LOW";
        if (confidence_score >= 80) confidence_tier = "HIGH";
        else if (confidence_score >= 60) confidence_tier = "MEDIUM";

        return {
            scoring_version: "5.0-Solana-8Layers",
            final_risk_score: finalScore,
            original_score: finalScoreRaw,
            risk_level: riskLevel,
            primary_risk_factor,
            top_risk_factors,
            overrides: overrideResult.override_reasons,
            risk_breakdown: {
                // Backward compatibility fields
                authority_risk: Math.round(authScore),
                holder_risk: Math.round(layer3Score),
                liquidity_risk: Math.round(layer2Score),
                deployer_risk: Math.round(deployerRepRisk),
                behavioral_risk: Math.round((layer5Score + layer7Score) / 2),
                
                // Detailed 8-Layer breakdown
                token_security: layer1Score,
                liquidity: layer2Score,
                holder_intelligence: layer3Score,
                wallet_intelligence: layer4Score,
                launch_intelligence: layer5Score,
                developer_trust: layer6Score,
                market_manipulation: layer7Score,
                social_intelligence: layer8Score
            },
            confidence_score,
            confidence_tier
        };
    }
}

module.exports = RiskScoringAgent;
