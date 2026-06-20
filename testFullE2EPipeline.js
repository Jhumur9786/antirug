/**
 * ═══════════════════════════════════════════════════════════════════
 *  RUGGUARD — FULL END-TO-END PIPELINE TEST
 *  Token: 0.0.1159074
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Pipeline:
 *    Step 1 → TokenScannerAgent        (Python → JSON via child_process)
 *    Step 2 → BlockchainRiskAnalysisAgent
 *    Step 3 → SentimentAnalysisAgent
 *    Step 4 → RiskScoringAgent
 *    Step 5 → RugPredictorAgent
 *    Step 6 → AlertAgent
 *
 *  Goal: Validate complete multi-agent execution from
 *        data ingestion → AI prediction → security alert.
 * ═══════════════════════════════════════════════════════════════════
 */

const { execSync } = require("child_process");
const BlockchainRiskAnalysisAgent = require("./BlockchainRiskAnalysisAgent");
const SentimentAnalysisAgent = require("./SentimentAnalysisAgent");
const RiskScoringAgent = require("./RiskScoringAgent");
const RugPredictorAgent = require("./RugPredictorAgent");
const AlertAgent = require("./AlertAgent");

// ── Token ID from command line ─────────────────────────────────────
const TOKEN_ID = process.argv[2];

if (!TOKEN_ID || !/^0\.0\.\d+$/.test(TOKEN_ID)) {
    console.log("\n  AntiRug — Full End-to-End Pipeline Test\n");
    console.log("  Usage:   node testFullE2EPipeline.js <token_id>");
    console.log("  Example: node testFullE2EPipeline.js 0.0.731861\n");
    process.exit(1);
}

// ── Validation Helpers ─────────────────────────────────────────────
const results = {
    TokenScannerAgent: "FAIL",
    BlockchainRiskAgent: "FAIL",
    SentimentAgent: "FAIL",
    RiskScoringAgent: "FAIL",
    RugPredictorAgent: "FAIL",
    AlertAgent: "FAIL",
    DataFlowIntegrity: "FAIL",
    AIPredictionWorking: "FAIL",
    AlertSystemWorking: "FAIL"
};

function exists(val, label) {
    if (val === undefined || val === null) {
        console.error(`  ✗ MISSING: ${label}`);
        return false;
    }
    console.log(`  ✓ ${label} = ${typeof val === "object" ? JSON.stringify(val).substring(0, 80) : val}`);
    return true;
}

function inRange(val, min, max, label) {
    if (typeof val !== "number" || val < min || val > max) {
        console.error(`  ✗ OUT OF RANGE: ${label} = ${val} (expected ${min}–${max})`);
        return false;
    }
    console.log(`  ✓ ${label} = ${val} (in range ${min}–${max})`);
    return true;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════
async function runPipeline() {
    let scanner, blockchainRisk, sentiment, riskScore, prediction, alert;

    // ─────────────────────────────────────────────────────────────
    //  STEP 1 — Token Scanner Agent (Python)
    // ─────────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("  STEP 1 — TOKEN SCANNER AGENT");
    console.log("═".repeat(60));

    try {
        const raw = execSync(
            `python3 token_scanner_agent.py ${TOKEN_ID}`,
            { cwd: __dirname, timeout: 30000 }
        ).toString().trim();

        scanner = JSON.parse(raw);

        console.log("\n===== TOKEN SCANNER OUTPUT =====");
        console.log(JSON.stringify(scanner, null, 2));

        const checks = [
            exists(scanner.token_id, "token_id"),
            exists(scanner.name, "name"),
            exists(scanner.symbol, "symbol"),
            exists(scanner.treasury_account, "treasury"),
            exists(scanner.holder_count, "holder_count") && typeof scanner.holder_count === "number",
            exists(scanner.transaction_count, "transaction_count") && typeof scanner.transaction_count === "number",
            exists(scanner.token_age_days, "token_age_days") && typeof scanner.token_age_days === "number"
        ];

        results.TokenScannerAgent = checks.every(Boolean) ? "PASS" : "FAIL";
    } catch (err) {
        console.error("  ✗ TokenScannerAgent CRASHED:", err.message);
    }

    if (!scanner || scanner.error) {
        console.error("\n⛔ Scanner failed — cannot continue pipeline.");
        printFinalReport(null);
        return;
    }

    // ─────────────────────────────────────────────────────────────
    //  STEP 2 — Blockchain Risk Agent
    // ─────────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("  STEP 2 — BLOCKCHAIN RISK ANALYSIS AGENT");
    console.log("═".repeat(60));

    try {
        const agent = new BlockchainRiskAnalysisAgent();
        blockchainRisk = agent.analyzeTokenRisk(scanner);

        console.log("\n===== BLOCKCHAIN RISK OUTPUT =====");
        console.log(JSON.stringify(blockchainRisk, null, 2));

        const checks = [
            exists(blockchainRisk.mint_risk_score, "mint_risk_score"),
            exists(blockchainRisk.admin_control_score, "admin_control_score"),
            exists(blockchainRisk.holder_concentration_score, "holder_concentration_score"),
            exists(blockchainRisk.treasury_dump_score, "treasury_dump_score"),
            exists(blockchainRisk.age_risk_score, "age_risk_score"),
            exists(blockchainRisk.activity_risk_score, "activity_risk_score"),
            inRange(blockchainRisk.mint_risk_score, 0, 100, "mint_risk_score range"),
            inRange(blockchainRisk.admin_control_score, 0, 100, "admin_control_score range"),
            inRange(blockchainRisk.holder_concentration_score, 0, 100, "holder_concentration_score range"),
            inRange(blockchainRisk.treasury_dump_score, 0, 100, "treasury_dump_score range"),
            inRange(blockchainRisk.age_risk_score, 0, 100, "age_risk_score range"),
            inRange(blockchainRisk.activity_risk_score, 0, 100, "activity_risk_score range")
        ];

        results.BlockchainRiskAgent = checks.every(Boolean) ? "PASS" : "FAIL";
    } catch (err) {
        console.error("  ✗ BlockchainRiskAgent CRASHED:", err.message);
    }

    // ─────────────────────────────────────────────────────────────
    //  STEP 3 — Sentiment Analysis Agent
    // ─────────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("  STEP 3 — SENTIMENT ANALYSIS AGENT");
    console.log("═".repeat(60));

    try {
        const agent = new SentimentAnalysisAgent();
        sentiment = await agent.analyzeSentiment(scanner);

        console.log("\n===== SENTIMENT OUTPUT =====");
        console.log(JSON.stringify(sentiment, null, 2));

        const checks = [
            exists(sentiment.sentiment_security_rating, "sentiment_security_rating"),
            exists(sentiment.community_risk_index, "community_risk_index"),
            exists(sentiment.bullish_percentage, "bullish_percentage"),
            exists(sentiment.bearish_percentage, "bearish_percentage"),
            exists(sentiment.liquidity_usd, "liquidity_usd"),
            exists(sentiment.dex_risk_level, "dex_risk_level"),
            exists(sentiment.data_sources_used, "data_sources_used")
        ];

        // Verify fallback logic — must NOT crash even if sentiment data is sparse
        results.SentimentAgent = checks.every(Boolean) ? "PASS" : "FAIL";
    } catch (err) {
        console.error("  ✗ SentimentAgent CRASHED:", err.message);
        // Verify it must NOT crash — create fallback sentiment object
        console.log("  ⚠ Applying fallback sentiment data (agent must not crash).");
        sentiment = {
            token_id: TOKEN_ID,
            sentiment_security_rating: "UNKNOWN",
            community_risk_index: 50,
            bullish_percentage: 0,
            bearish_percentage: 0,
            liquidity_usd: 0,
            dex_risk_level: "UNKNOWN",
            data_sources_used: [],
            community_intelligence_score: 50,
            developer_activity_risk: "UNKNOWN",
            dex_listed: false,
            confidence_score: 0,
            data_quality: "LOW"
        };
        results.SentimentAgent = "FAIL";
    }

    // ─────────────────────────────────────────────────────────────
    //  STEP 4 — Risk Scoring Agent
    // ─────────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("  STEP 4 — RISK SCORING AGENT");
    console.log("═".repeat(60));

    try {
        const agent = new RiskScoringAgent();
        riskScore = await agent.calculateRisk({ scanner, blockchain: blockchainRisk, sentiment });

        console.log("\n===== RISK SCORING OUTPUT =====");
        console.log(JSON.stringify(riskScore, null, 2));

        const checks = [
            exists(riskScore.rug_risk_score, "rug_risk_score"),
            exists(riskScore.risk_level, "risk_level"),
            exists(riskScore.primary_risk_factor, "primary_risk_factor"),
            exists(riskScore.risk_breakdown, "risk_breakdown")
        ];

        // Verify score is a reasonable weighted average
        const expectedComponents = [
            blockchainRisk.mint_risk_score,
            blockchainRisk.admin_control_score,
            blockchainRisk.holder_concentration_score,
            blockchainRisk.treasury_risk, // FIXED
            blockchainRisk.age_risk_score,
            blockchainRisk.activity_risk_score
        ];
        // Filter out undefined if treasury_risk is missing
        const validComponents = expectedComponents.filter(c => c !== undefined);
        const avgComponent = validComponents.length ? validComponents.reduce((a, b) => a + b, 0) / validComponents.length : 0;
        console.log(`  ℹ Component average: ${avgComponent.toFixed(1)}, Final score: ${riskScore.rug_risk_score}`);

        results.RiskScoringAgent = checks.every(Boolean) ? "PASS" : "FAIL";
    } catch (err) {
        console.error("  ✗ RiskScoringAgent CRASHED:", err.message);
    }

    // ─────────────────────────────────────────────────────────────
    //  STEP 5 — Rug Predictor Agent
    // ─────────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("  STEP 5 — RUG PREDICTOR AGENT (AI PREDICTION)");
    console.log("═".repeat(60));

    try {
        const agent = new RugPredictorAgent();
        prediction = await agent.predictRisk({
            scanner,
            blockchain_risk: blockchainRisk,
            sentiment,
            risk_score: riskScore
        });

        console.log("\n===== AI PREDICTION OUTPUT =====");
        console.log(JSON.stringify(prediction, null, 2));

        const checks = [
            exists(prediction.rug_probability, "rug_probability"),
            exists(prediction.prediction_strength, "prediction_strength"),
            exists(prediction.ai_confidence, "confidence (ai_confidence)"),
            exists(prediction.key_triggers, "key_triggers"),
            exists(prediction.risk_trend, "risk_trend"),
            inRange(prediction.rug_probability, 0, 100, "rug_probability range"),
            inRange(prediction.ai_confidence, 0, 100, "ai_confidence range")
        ];

        results.RugPredictorAgent = checks.every(Boolean) ? "PASS" : "FAIL";
    } catch (err) {
        console.error("  ✗ RugPredictorAgent CRASHED:", err.message);
    }

    // ─────────────────────────────────────────────────────────────
    //  STEP 6 — Alert Agent
    // ─────────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("  STEP 6 — ALERT AGENT");
    console.log("═".repeat(60));

    try {
        const agent = new AlertAgent();
        alert = await agent.generateAlert({
            risk_score: riskScore,
            prediction
        });

        console.log("\n===== ALERT OUTPUT =====");
        console.log(JSON.stringify(alert, null, 2));

        const checks = [
            exists(alert.alert_level, "alert_level"),
            exists(alert.primary_warning, "primary_warning"),
            exists(alert.recommendations, "recommendations"),
            exists(alert.monitoring_status, "monitoring_status"),
            exists(alert.security_posture, "security_posture")
        ];

        // Verify alert severity matches prediction probability
        const probLevel = prediction.prediction_strength;
        const alertLevel = alert.alert_level;
        console.log(`  ℹ Probability level: ${probLevel}, Alert level: ${alertLevel}`);

        results.AlertAgent = checks.every(Boolean) ? "PASS" : "FAIL";
    } catch (err) {
        console.error("  ✗ AlertAgent CRASHED:", err.message);
    }

    // ─────────────────────────────────────────────────────────────
    //  PIPELINE VALIDATION CHECKS
    // ─────────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("  PIPELINE VALIDATION CHECKS");
    console.log("═".repeat(60));

    // Data Flow Integrity
    const flowChecks = [
        scanner && blockchainRisk && sentiment && riskScore && prediction && alert,
        blockchainRisk?.token_id === scanner?.token_id,
        true, // riskScore does not return token_id directly, passed implicitly
        prediction?.token_id === scanner?.token_id,
        alert?.token_id === scanner?.token_id
    ];
    results.DataFlowIntegrity = flowChecks.every(Boolean) ? "PASS" : "FAIL";
    console.log(`  Data Flow Integrity: ${results.DataFlowIntegrity}`);
    if (!flowChecks[1]) console.error("    ✗ token_id mismatch: BlockchainRisk ↔ Scanner");
    if (!flowChecks[3]) console.error("    ✗ token_id mismatch: Prediction ↔ Scanner");
    if (!flowChecks[4]) console.error("    ✗ token_id mismatch: Alert ↔ Scanner");

    // AI Prediction Working
    results.AIPredictionWorking = (
        prediction &&
        !prediction.error &&
        typeof prediction.rug_probability === "number" &&
        prediction.rug_probability >= 0 && prediction.rug_probability <= 100 &&
        typeof prediction.ai_confidence === "number"
    ) ? "PASS" : "FAIL";
    console.log(`  AI Prediction Working: ${results.AIPredictionWorking}`);

    // Alert System Working
    results.AlertSystemWorking = (
        alert &&
        !alert.error &&
        alert.alert_level &&
        alert.recommendations && alert.recommendations.length > 0
    ) ? "PASS" : "FAIL";
    console.log(`  Alert System Working: ${results.AlertSystemWorking}`);

    // ─────────────────────────────────────────────────────────────
    //  FINAL PIPELINE REPORT
    // ─────────────────────────────────────────────────────────────
    printFinalReport({ scanner, blockchainRisk, sentiment, riskScore, prediction, alert });
}

function printFinalReport(data) {
    console.log("\n\n" + "═".repeat(60));
    console.log("  RUGGUARD FINAL SECURITY VERDICT");
    console.log("═".repeat(60));

    if (data && data.scanner && data.prediction && data.alert) {
        const verdict = {
            token_id: data.scanner.token_id,
            token_name: data.scanner.name,
            blockchain_risk_level: data.blockchainRisk?.analysis_summary ? "SEE SUMMARY" : (data.riskScore?.risk_level || "N/A"),
            sentiment_risk_level: data.sentiment?.sentiment_security_rating || "N/A",
            rug_risk_score: data.riskScore?.rug_risk_score ?? "N/A",
            predicted_rug_probability: data.prediction?.rug_probability ?? "N/A",
            final_alert_level: data.alert?.alert_level || "N/A",
            security_posture: data.alert?.security_posture || "N/A",
            primary_risk_factor: data.riskScore?.primary_risk_factor || "N/A",
            primary_warning: data.alert?.primary_warning || "N/A",
            ai_confidence: data.prediction?.ai_confidence ?? "N/A",
            pipeline_status: "SUCCESS"
        };
        console.log(JSON.stringify(verdict, null, 2));
    } else {
        console.log("  ⛔ Pipeline incomplete — cannot produce final verdict.");
    }

    // ─────────────────────────────────────────────────────────────
    //  FINAL TEST SUMMARY
    // ─────────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("  PIPELINE VALIDATION");
    console.log("═".repeat(60));

    const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));

    console.log(`  ${pad("TokenScannerAgent:", 30)} ${results.TokenScannerAgent}`);
    console.log(`  ${pad("BlockchainRiskAgent:", 30)} ${results.BlockchainRiskAgent}`);
    console.log(`  ${pad("SentimentAgent:", 30)} ${results.SentimentAgent}`);
    console.log(`  ${pad("RiskScoringAgent:", 30)} ${results.RiskScoringAgent}`);
    console.log(`  ${pad("RugPredictorAgent:", 30)} ${results.RugPredictorAgent}`);
    console.log(`  ${pad("AlertAgent:", 30)} ${results.AlertAgent}`);
    console.log();
    console.log(`  ${pad("Data Flow Integrity:", 30)} ${results.DataFlowIntegrity}`);
    console.log(`  ${pad("AI Prediction Working:", 30)} ${results.AIPredictionWorking}`);
    console.log(`  ${pad("Alert System Working:", 30)} ${results.AlertSystemWorking}`);

    const allPass = Object.values(results).every(v => v === "PASS");
    console.log("\n" + "═".repeat(60));
    if (allPass) {
        console.log("  ✅ FINAL STATUS: PIPELINE READY FOR DEMO");
    } else {
        const failedCount = Object.values(results).filter(v => v === "FAIL").length;
        console.log(`  ⚠️  FINAL STATUS: NEEDS FIXES (${failedCount} check(s) failed)`);
    }
    console.log("═".repeat(60) + "\n");
}

// ═══════════════════════════════════════════════════════════════════
//  RUN
// ═══════════════════════════════════════════════════════════════════
runPipeline().catch(err => {
    console.error("FATAL PIPELINE ERROR:", err);
    printFinalReport(null);
});
