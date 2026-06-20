/**
 * ═══════════════════════════════════════════════════════════════
 *  HARD TEST: Verify ALL LLM-integrated agents produce AI output
 * ═══════════════════════════════════════════════════════════════
 */
require("dotenv").config({ path: "/Users/tutul/Documents/antirug/.env" });

const SentimentAnalysisAgent = require("/Users/tutul/Documents/antirug/SentimentAnalysisAgent");
const RiskScoringAgent = require("/Users/tutul/Documents/antirug/RiskScoringAgent");
const RugPredictorAgent = require("/Users/tutul/Documents/antirug/RugPredictorAgent");
const AlertAgent = require("/Users/tutul/Documents/antirug/AlertAgent");
const ConversationalAgent = require("/Users/tutul/Documents/antirug/ConversationalAgent");

let passed = 0, failed = 0;

function check(label, condition, detail = "") {
    if (condition) {
        passed++;
        console.log(`  ✅ ${label}${detail ? " → " + detail : ""}`);
    } else {
        failed++;
        console.log(`  ❌ ${label}${detail ? " → " + detail : ""}`);
    }
}

// Realistic input data (simulating TokenScanner + BlockchainRisk output)
const scannerData = {
    token_id: "0.0.1159074",
    name: "GRELF",
    symbol: "GRELF",
    total_supply: 100000000,
    treasury_balance: 0,
    holder_count: 150,
    token_age_days: 45,
    supply_key_exists: true,
    admin_key_exists: true,
    has_mint_authority: true,
    has_admin_key: true,
    has_freeze_key: false,
    top_holder_percentage: 25,
    transaction_count: 500,
    recent_transaction_count: 10,
    last_transaction_timestamp: new Date().toISOString(),
};

const blockchainRisk = {
    mint_risk_score: 80,
    mint_risk_level: "HIGH",
    admin_control_score: 80,
    admin_control_risk: "HIGH",
    holder_concentration_score: 50,
    holder_concentration_risk: "MEDIUM",
    treasury_dump_score: 20,
    treasury_dump_risk: "LOW",
    age_risk_score: 50,
    age_risk_level: "MEDIUM",
    activity_risk_score: 20,
    activity_risk_level: "LOW",
};

async function runTests() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  HARD TEST: ALL LLM AGENT INTEGRATIONS");
    console.log("═══════════════════════════════════════════════════════\n");

    // ── 1. SENTIMENT ANALYSIS AGENT ──────────────────────────────
    console.log("🔬 [AGENT 1/5] SentimentAnalysisAgent — LLM Test");
    let sentiment;
    try {
        const sentAgent = new SentimentAnalysisAgent();
        sentiment = await sentAgent.analyzeSentiment(scannerData);
        check("Agent returned data", !!sentiment);
        check("ai_sentiment_summary exists", !!sentiment.ai_sentiment_summary,
            typeof sentiment.ai_sentiment_summary === "string" ? sentiment.ai_sentiment_summary.substring(0, 80) + "..." : "MISSING");
        check("ai_sentiment_summary is NOT fallback", 
            sentiment.ai_sentiment_summary !== "AI sentiment analysis unavailable" && sentiment.ai_sentiment_summary !== "N/A",
            "Real AI output confirmed");
        check("ai_market_confidence exists", !!sentiment.ai_market_confidence,
            String(sentiment.ai_market_confidence));
        check("sentiment_security_rating exists", !!sentiment.sentiment_security_rating,
            sentiment.sentiment_security_rating);
    } catch (err) {
        failed++;
        console.log(`  ❌ SentimentAnalysisAgent CRASHED: ${err.message}`);
        sentiment = { community_risk_index: 50, dex_risk_level: "MEDIUM", developer_activity_risk: "UNKNOWN", external_risk_rating: "MEDIUM" };
    }
    console.log();

    // ── 2. RISK SCORING AGENT ────────────────────────────────────
    console.log("🔬 [AGENT 2/5] RiskScoringAgent — LLM Test");
    let riskScore;
    try {
        const riskAgent = new RiskScoringAgent();
        riskScore = await riskAgent.calculateRisk({
            scanner: scannerData,
            blockchain: blockchainRisk,
            sentiment: sentiment,
        });
        check("Agent returned data", !!riskScore);
        check("rug_risk_score exists", riskScore.rug_risk_score !== undefined,
            `${riskScore.rug_risk_score}/100`);
        check("ai_risk_summary exists", !!riskScore.ai_risk_summary,
            typeof riskScore.ai_risk_summary === "string" ? riskScore.ai_risk_summary.substring(0, 80) + "..." : "MISSING");
        check("ai_risk_summary is NOT fallback",
            riskScore.ai_risk_summary !== "AI risk analysis unavailable" && riskScore.ai_risk_summary !== "N/A",
            "Real AI output confirmed");
        check("analysis_mode is AI-enhanced", riskScore.analysis_mode === "AI_ENHANCED" || riskScore.analysis_mode === "FULL_AI" || riskScore.analysis_mode === "HYBRID_AI",
            riskScore.analysis_mode || "MISSING");
    } catch (err) {
        failed++;
        console.log(`  ❌ RiskScoringAgent CRASHED: ${err.message}`);
        riskScore = { rug_risk_score: 50, risk_level: "MEDIUM", confidence_score: 70 };
    }
    console.log();

    // ── 3. RUG PREDICTOR AGENT ───────────────────────────────────
    console.log("🔬 [AGENT 3/5] RugPredictorAgent — LLM Test");
    let prediction;
    try {
        const predAgent = new RugPredictorAgent();
        prediction = await predAgent.predictRisk({
            scanner: scannerData,
            blockchain_risk: blockchainRisk,
            sentiment: sentiment,
            risk_score: riskScore,
        });
        check("Agent returned data", !!prediction);
        check("rug_probability exists", prediction.rug_probability !== undefined,
            `${prediction.rug_probability}%`);
        check("prediction_status is FULL_AI_ANALYSIS",
            prediction.prediction_status === "FULL_AI_ANALYSIS",
            prediction.prediction_status || "MISSING");
        check("ai_prediction_summary exists", !!prediction.ai_prediction_summary,
            typeof prediction.ai_prediction_summary === "string" ? prediction.ai_prediction_summary.substring(0, 80) + "..." : "MISSING");
        check("ai_prediction_summary is NOT fallback",
            prediction.ai_prediction_summary !== "AI reasoning temporarily unavailable – deterministic risk analysis applied.",
            "Real AI output confirmed");
        check("ai_risk_scenario exists", !!prediction.ai_risk_scenario,
            typeof prediction.ai_risk_scenario === "string" ? prediction.ai_risk_scenario.substring(0, 80) + "..." : "MISSING");
        check("risk_simulation has 5 scenarios",
            prediction.risk_simulation && prediction.risk_simulation.length === 5,
            prediction.risk_simulation ? prediction.risk_simulation.map(s => `${s.scenario}: ${s.new_probability}%`).join(" | ") : "MISSING");
    } catch (err) {
        failed++;
        console.log(`  ❌ RugPredictorAgent CRASHED: ${err.message}`);
        prediction = { rug_probability: 40, prediction_strength: "WEAK", ai_confidence: 70 };
    }
    console.log();

    // ── 4. ALERT AGENT ───────────────────────────────────────────
    console.log("🔬 [AGENT 4/5] AlertAgent — LLM Test");
    let alert;
    try {
        const alertAgent = new AlertAgent();
        alert = await alertAgent.generateAlert({
            risk_score: riskScore,
            prediction: prediction,
        });
        check("Agent returned data", !!alert);
        check("alert_level exists", !!alert.alert_level, alert.alert_level);
        check("ai_alert_summary exists", !!alert.ai_alert_summary,
            typeof alert.ai_alert_summary === "string" ? alert.ai_alert_summary.substring(0, 80) + "..." : "MISSING");
        check("ai_alert_summary is NOT fallback",
            alert.ai_alert_summary !== "AI alert analysis unavailable" && alert.ai_alert_summary !== "N/A" && alert.ai_alert_summary !== undefined,
            "Real AI output confirmed");
        check("recommendations exist", alert.recommendations && alert.recommendations.length > 0,
            alert.recommendations ? alert.recommendations.join("; ").substring(0, 100) : "MISSING");
    } catch (err) {
        failed++;
        console.log(`  ❌ AlertAgent CRASHED: ${err.message}`);
    }
    console.log();

    // ── 5. CONVERSATIONAL AGENT ──────────────────────────────────
    console.log("🔬 [AGENT 5/5] ConversationalAgent — LLM Test");
    try {
        const convAgent = new ConversationalAgent();
        const fakeReport = {
            token_id: "0.0.1159074",
            token_name: "GRELF",
            rug_risk_score: riskScore.rug_risk_score || 50,
            predicted_probability: prediction.rug_probability || 40,
            risk_level: riskScore.risk_level || "MEDIUM",
            probability_level: prediction.prediction_strength || "WEAK",
            alert_level: alert?.alert_level || "MEDIUM",
            security_posture: alert?.security_posture || "CAUTION",
            confidence: prediction.ai_confidence || 70,
            key_triggers: prediction.key_triggers || [],
            recommendations: alert?.recommendations || [],
            agent_data: {
                scanner: scannerData,
                blockchain_risk: blockchainRisk,
                sentiment: sentiment,
                risk_score: riskScore,
                prediction: prediction,
                alert: alert || {},
            },
        };
        const result = await convAgent.chat("What is the risk of GRELF token?", [], fakeReport);
        check("Agent returned response", !!result && !!result.message,
            typeof result.message === "string" ? result.message.substring(0, 100) + "..." : "MISSING");
        check("alert_generation_mode is HYBRID_AI",
            result.alert_generation_mode === "HYBRID_AI",
            result.alert_generation_mode || "MISSING");
        check("ai_confidence exists", result.ai_confidence !== undefined,
            `${result.ai_confidence}%`);
    } catch (err) {
        failed++;
        console.log(`  ❌ ConversationalAgent CRASHED: ${err.message}`);
    }

    // ── FINAL REPORT ─────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════");
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    if (failed === 0) {
        console.log("  🏆 ALL LLM INTEGRATIONS VERIFIED — FULL AI MODE!");
    } else {
        console.log(`  ⚠️  ${failed} check(s) failed — review above`);
    }
    console.log("═══════════════════════════════════════════════════════\n");
}

runTests().catch(console.error);
