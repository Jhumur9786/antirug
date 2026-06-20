const askLLM = require("./llmClient");

class RugPredictorAgent {
    constructor() {
        this.modelName = "AntiRug Predictor";
        this.modelVersion = "AntiRug AI v2";
        this.modelType = "Explainable Risk Fusion AI";
        this.weights = {
            mint_risk: 0.13, admin_risk: 0.13, treasury_risk: 0.13,
            holder_concentration: 0.10, activity_risk: 0.08, age_risk: 0.05,
            community_sentiment: 0.10, liquidity_strength: 0.10,
            developer_activity: 0.05, external_intelligence: 0.05,
            freeze_risk: 0.03, wipe_risk: 0.05
        };
    }

    async predictRisk(input) {
        try {
            if (!input || !input.blockchain_risk || !input.risk_score) {
                return { error: "Incomplete risk pipeline data" };
            }

            const features = this._extractFeatures(input);
            const prediction = this._calculateProbability(features);
            let raw_prob = Math.round(prediction.probability * 100);
            const rug_probability = Math.max(0, Math.min(100, raw_prob));
            
            const triggers = this._detectTriggers(features);
            
            let prediction_strength = "WEAK";
            if (rug_probability > 75 && triggers.length > 3) prediction_strength = "STRONG";
            else if (rug_probability >= 50 && rug_probability <= 75) prediction_strength = "MODERATE";

            let time_horizon = "30-90 days";
            if (rug_probability > 75) time_horizon = "1-7 days";
            else if (rug_probability >= 50) time_horizon = "7-30 days";

            const risk_trend = this._detectTrend(input, features);
            const top_risk_drivers = this._calculateImportance(features).slice(0, 3).map(i => i.factor);
            const key_triggers = triggers;
            const risk_tags = this._generateRiskTags(features, triggers);
            const ai_confidence = this._calculateConfidence(input);
            const risk_simulation = this._simulateScenarios(features, input);

            let confidence_tier = "LOW";
            if (ai_confidence > 80) confidence_tier = "HIGH";
            else if (ai_confidence >= 60) confidence_tier = "MEDIUM";

            const token_id = input.scanner?.token_id || "unknown";

            // DETERMINISTIC BASE
            const deterministic_prediction = {
                token_id,
                rug_probability,
                prediction_strength,
                time_horizon,
                risk_trend,
                top_risk_drivers,
                key_triggers,
                risk_tags,
                prediction_status: "DETERMINISTIC_ONLY",
                ai_prediction_summary: "AI reasoning temporarily unavailable – deterministic risk analysis applied.",
                ai_key_triggers: [],
                ai_risk_scenario: "Prediction based on structural risk indicators.",
                ai_confidence_reasoning: "AI unavailable during analysis.",
                ai_recommendations: ["Monitor token activity"],
                ai_confidence,
                confidence_tier,
                risk_simulation
            };

            const risk_score = input.risk_score?.final_risk_score || "unknown";
            const mint_risk = input.blockchain_risk.mint_risk_score || "unknown";
            const admin_risk = input.blockchain_risk.admin_control_score || "unknown";
            const liquidity_risk = (input.sentiment && input.sentiment.dex_risk_level) ? input.sentiment.dex_risk_level : "unknown";
            const sentiment = (input.sentiment && input.sentiment.sentiment_security_rating) ? input.sentiment.sentiment_security_rating : "neutral";
            const community_risk = (input.sentiment && input.sentiment.community_risk_index) ? input.sentiment.community_risk_index : "unknown";
            const market_confidence = (input.sentiment && input.sentiment.ai_market_confidence) ? input.sentiment.ai_market_confidence : "unknown";

            const prompt = `You are a blockchain security risk prediction AI.

Explain WHY this token has rug risk. Evaluate the provided token risk intelligence and generate a professional security explanation.

INPUT DATA:

Token ID: ${token_id}
Risk Score: ${risk_score}
Rug Probability: ${rug_probability}
AI Confidence: ${ai_confidence}

Blockchain Risks:
- Mint Authority: ${mint_risk}
- Admin Control: ${admin_risk}
- Liquidity Risk: ${liquidity_risk}

Sentiment Signals:
- Market Sentiment: ${sentiment}
- Community Risk Index: ${community_risk}
- Market Confidence: ${market_confidence}

Detected Triggers:
${key_triggers.join(", ")}

Time Horizon:
${time_horizon}

TASK:

Generate:

1 Predictive risk summary (2 sentences max)
2 Key rug triggers (max 3)
3 Risk scenario simulation: Explain what could increase the probability.
4 AI confidence reasoning.
5 AI Recommendations: Limit to 3 recommendations.

RULES:

Be concise.
Do not invent information.
Use only provided data. Do not output placeholders.
Sound like a professional enterprise blockchain security report.
Focus on investor protection.

OUTPUT JSON:

{
 "ai_prediction_summary": "",
 "ai_key_triggers": [],
 "ai_risk_scenario": "",
 "ai_confidence_reasoning": "",
 "ai_recommendations": []
}`;

            let ai_analysis = {};
            try {
                let llmOutput = await askLLM(prompt, { response_format: { type: "json_object" }, max_tokens: 800 });
                llmOutput = llmOutput.replace(/^```json/mi, "").replace(/```/g, "").trim();
                const start = llmOutput.indexOf('{');
                const end = llmOutput.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    llmOutput = llmOutput.substring(start, end + 1);
                }
                ai_analysis = JSON.parse(llmOutput);
                ai_analysis.prediction_status = "FULL_AI_ANALYSIS";
            } catch (err) {
                console.error("[RugPredictorAgent] LLM parsing failed:", err.message);
                console.error("[RugPredictorAgent] Raw LLM Output:", llmOutput);
                ai_analysis.prediction_status = "DETERMINISTIC_ONLY";
            }

            return {
                ...deterministic_prediction,
                ...ai_analysis
            };

        } catch (error) {
            console.error("[RugPredictorAgent] Prediction Engine Failure:", error);
            return { error: "Internal Prediction Engine Error", details: error.message };
        }
    }

    _extractFeatures(input) {
        const br = input.blockchain_risk;
        const s = input.sentiment || {};
        const clamp = (val) => Math.max(0, Math.min(100, val || 0));
        return {
            mint_risk: clamp(br.mint_risk_score),
            admin_risk: clamp(br.admin_control_score),
            holder_concentration: clamp(br.holder_concentration_score),
            treasury_risk: clamp(br.treasury_dump_score),
            activity_risk: clamp(br.activity_risk_score),
            age_risk: clamp(br.age_risk_score),
            community_sentiment: clamp(s.community_intelligence_score !== undefined ? (100 - s.community_intelligence_score) : (s.community_risk_index || 50)),
            liquidity_strength: clamp(s.dex_risk_level === "HIGH" ? 90 : (s.dex_risk_level === "MEDIUM" ? 40 : 10)),
            developer_activity: clamp(s.developer_activity_risk === "HIGH RISK" ? 90 : (s.developer_activity_risk === "MEDIUM" ? 50 : 10)),
            external_intelligence: clamp(s.external_risk_rating === "HIGH" ? 85 : (s.external_risk_rating === "LOW" ? 20 : 50)),
            freeze_risk: clamp(br.freeze_risk_score || 0),
            wipe_risk: clamp(br.wipe_risk_score || 0)
        };
    }

    _calculateProbability(f) {
        let sum = 0;
        for (const [k, w] of Object.entries(this.weights)) {
            if (f[k] !== undefined) sum += f[k] * w;
        }
        return { probability: Math.max(0, Math.min(1, sum / 100)) };
    }

    _detectTriggers(f) {
        return [
            { id: "Token supply can be increased by admin", val: f.mint_risk },
            { id: "Treasury wallet concentration detected", val: f.treasury_risk },
            { id: "Critically low liquidity depth", val: f.liquidity_strength },
            { id: "Significant developer inactivity", val: f.developer_activity },
            { id: "Negative community sentiment", val: f.community_sentiment },
            { id: "Centralized administrative control detected", val: f.admin_risk },
            { id: "High holder concentration", val: f.holder_concentration },
            { id: "Freeze authority enables account asset locks", val: f.freeze_risk },
            { id: "Wipe authority enables token confiscation", val: f.wipe_risk }
        ].sort((a, b) => b.val - a.val).filter(i => i.val > 40).map(i => i.id);
    }

    _calculateImportance(f) {
        const labels = {
            mint_risk: "Active mint authority", admin_risk: "Centralized governance", treasury_risk: "Treasury concentration",
            holder_concentration: "Holder concentration", activity_risk: "Low transactional activity", community_sentiment: "Negative community sentiment",
            liquidity_strength: "Shallow liquidity pools", developer_activity: "Developer abandonment", external_intelligence: "Negative external signals",
            freeze_risk: "Freeze authority risk", wipe_risk: "Wipe authority risk"
        };
        return Object.entries(labels).map(([k, label]) => ({ factor: label, val: f[k] || 0 }))
            .sort((a, b) => b.val - a.val);
    }

    _detectTrend(input, f) {
        const s = input.sentiment || {};
        const br = input.blockchain_risk;
        const communityRisk = s.community_intelligence_score !== undefined ? (100 - s.community_intelligence_score) : (s.community_risk_index || 50);
        if (communityRisk > 60 && br.admin_control_score > 60) return "DETERIORATING";
        if (communityRisk < 40 && br.admin_control_score < 40) return "IMPROVING";
        return "STABLE";
    }

    _generateRiskTags(features, triggers) {
        const tags = [];
        if (features.mint_risk > 60) tags.push("MINT_AUTHORITY");
        if (features.admin_risk > 60) tags.push("ADMIN_CONTROL");
        if (features.treasury_risk > 60) tags.push("TREASURY_RISK");
        if (features.liquidity_strength > 60) tags.push("LOW_LIQUIDITY");
        if (features.developer_activity > 60) tags.push("DEV_INACTIVE");
        if (features.community_sentiment > 60) tags.push("NEGATIVE_SENTIMENT");
        if (features.holder_concentration > 60) tags.push("WHALE_DOMINATED");
        if (features.freeze_risk > 40) tags.push("FREEZE_AUTHORITY");
        if (features.wipe_risk > 40) tags.push("WIPE_AUTHORITY");
        return tags;
    }

    _simulateScenarios(features, input) {
        const scenarios = [];
        const clamp = (val) => Math.max(0, Math.min(100, val || 0));
        
        // 1. Liquidity crisis — model near-zero liquidity
        const s1Features = { ...features, liquidity_strength: clamp(Math.max(features.liquidity_strength * 3, 80)) };
        scenarios.push({
            scenario: "Liquidity collapses (near zero)",
            new_probability: Math.round(this._calculateProbability(s1Features).probability * 100)
        });

        // 2. Admin key removed
        const s2Features = { ...features, admin_risk: 0, mint_risk: clamp(features.mint_risk * 0.5) };
        scenarios.push({
            scenario: "Admin key removed",
            new_probability: Math.round(this._calculateProbability(s2Features).probability * 100)
        });

        // 3. Transaction activity increases
        const s3Features = { ...features, activity_risk: clamp(features.activity_risk * 0.5) };
        scenarios.push({
            scenario: "Transaction activity increases",
            new_probability: Math.round(this._calculateProbability(s3Features).probability * 100)
        });

        // 4. Liquidity grows to $1M+ (healthy liquidity + reduced external risk)
        const s4Features = { ...features, liquidity_strength: 5, external_intelligence: clamp(features.external_intelligence * 0.5) };
        scenarios.push({
            scenario: "Liquidity increases to $1 million",
            new_probability: Math.round(this._calculateProbability(s4Features).probability * 100)
        });

        // 5. Admin key removed AND Liquidity increases (Combined best case)
        const s5Features = { ...features, admin_risk: 0, mint_risk: clamp(features.mint_risk * 0.5), liquidity_strength: 5, external_intelligence: clamp(features.external_intelligence * 0.5) };
        scenarios.push({
            scenario: "Admin key removed AND Liquidity increases to $1 million",
            new_probability: Math.round(this._calculateProbability(s5Features).probability * 100)
        });

        return scenarios;
    }

    _calculateConfidence(input) {
        // Start with base from RiskScoringAgent (typically 70-80)
        let base = input.risk_score.confidence_score || 80;
        
        if (!input.sentiment) return Math.max(10, base - 25);
        
        const s = input.sentiment;
        const br = input.blockchain_risk;

        // Decrease confidence if key security data is missing or "UNKNOWN"
        if (s.developer_activity_risk === "UNKNOWN") base -= 10;
        if (s.sentiment_security_rating === "UNKNOWN") base -= 5;
        if (!s.dex_listed) base -= 10;

        // Decrease confidence if risk signals are contradictory or extreme (making the prediction harder)
        if (br.mint_risk_score > 80) base -= 5;
        if (br.admin_control_score > 80) base -= 5;
        
        // Decrease confidence if liquidity is very low (less reliable market data)
        if (s.liquidity_usd < 50000 && s.liquidity_usd > 0) base -= 5;
        if (s.liquidity_usd === 0) base -= 10;

        // Increase confidence if data is exceptionally strong/transparent
        if (s.data_quality === "HIGH") base += 5;
        if (s.posts_analyzed > 50) base += 5;

        return Math.min(95, Math.max(10, Math.round(base)));
    }
}

module.exports = RugPredictorAgent;
