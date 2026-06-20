/**
 * AlertAgent Full Pipeline Integration Test
 * 
 * Runs the complete AntiRug pipeline end-to-end:
 *   TokenScannerAgent (Python) →
 *   BlockchainRiskAnalysisAgent →
 *   SentimentAnalysisAgent →
 *   RiskScoringAgent →
 *   RugPredictorAgent →
 *   AlertAgent ← (target under test)
 * 
 * Token: 0.0.2283230
 */
const { execSync } = require("child_process");
const BlockchainRiskAnalysisAgent = require("./BlockchainRiskAnalysisAgent");
const SentimentAnalysisAgent = require("./SentimentAnalysisAgent");
const RiskScoringAgent = require("./RiskScoringAgent");
const RugPredictorAgent = require("./RugPredictorAgent");
const AlertAgent = require("./AlertAgent");

// ── Validation Helpers ─────────────────────────────────────────────
const check = (label, condition) => {
    const mark = condition ? "✅" : "❌";
    console.log(`  ${mark} ${label}`);
    return condition;
};

const isCleanValue = (v) => v !== null && v !== undefined && (typeof v !== "number" || !isNaN(v));

async function runAlertAgentPipelineTest() {
    const tokenId = "0.0.2283230";
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║   RUGGUARD ALERTAGENT — FULL PIPELINE INTEGRATION TEST      ║");
    console.log(`║   Token: ${tokenId}                                         ║`);
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    const results = {
        alert_generation: false,
        alert_logic: false,
        recommendation_engine: false,
        severity_mapping: false,
        edge_case: false,
        pipeline_integration: false
    };

    try {
        // ═══════════════════════════════════════════════════════════
        // STAGE 1 — TokenScannerAgent (Python)
        // ═══════════════════════════════════════════════════════════
        console.log("[1/6] Running TokenScannerAgent (Python)...");
        const scannerRaw = execSync(`python3 token_scanner_agent.py ${tokenId}`).toString();
        const scanner = JSON.parse(scannerRaw);
        if (scanner.error) throw new Error(`Scanner Error: ${scanner.error}`);
        console.log(`  → Scanner OK: ${scanner.name} (${scanner.symbol})\n`);

        // ═══════════════════════════════════════════════════════════
        // STAGE 2 — BlockchainRiskAnalysisAgent
        // ═══════════════════════════════════════════════════════════
        console.log("[2/6] Running BlockchainRiskAnalysisAgent...");
        const blockchainAgent = new BlockchainRiskAnalysisAgent();
        const blockchain = blockchainAgent.analyzeTokenRisk(scanner);
        console.log(`  → Blockchain Risk OK: mint=${blockchain.mint_risk_level} admin=${blockchain.admin_control_risk}\n`);

        // ═══════════════════════════════════════════════════════════
        // STAGE 3 — SentimentAnalysisAgent
        // ═══════════════════════════════════════════════════════════
        console.log("[3/6] Running SentimentAnalysisAgent...");
        const sentimentAgent = new SentimentAnalysisAgent();
        const sentiment = await sentimentAgent.analyzeSentiment(scanner);
        console.log(`  → Sentiment OK: rating=${sentiment.sentiment_security_rating} posts=${sentiment.posts_analyzed}\n`);

        // ═══════════════════════════════════════════════════════════
        // STAGE 4 — RiskScoringAgent
        // ═══════════════════════════════════════════════════════════
        console.log("[4/6] Running RiskScoringAgent...");
        const scoringAgent = new RiskScoringAgent();
        const riskScore = await scoringAgent.calculateRisk({ scanner, blockchain, sentiment });
        console.log(`  → Risk Score OK: score=${riskScore.rug_risk_score} level=${riskScore.risk_level}\n`);

        // ═══════════════════════════════════════════════════════════
        // STAGE 5 — RugPredictorAgent
        // ═══════════════════════════════════════════════════════════
        console.log("[5/6] Running RugPredictorAgent...");
        const predictorAgent = new RugPredictorAgent();
        const prediction = predictorAgent.predictRisk({
            scanner,
            blockchain_risk: blockchain,
            sentiment,
            risk_score: riskScore
        });
        console.log(`  → Prediction OK: prob=${prediction.rug_probability} level=${prediction.probability_level} confidence=${prediction.ai_confidence}\n`);

        // ═══════════════════════════════════════════════════════════
        // STAGE 6 — AlertAgent (TARGET UNDER TEST)
        // ═══════════════════════════════════════════════════════════
        console.log("[6/6] Running AlertAgent...");
        const alertAgent = new AlertAgent();
        const alert = alertAgent.generateAlert({
            risk_score: riskScore,
            prediction: prediction
        });

        console.log("\n===== ALERT AGENT OUTPUT =====\n");
        console.log(JSON.stringify(alert, null, 2));
        console.log("\n==============================\n");

        // ═══════════════════════════════════════════════════════════
        // VALIDATION 1 — Alert Generation (field existence)
        // ═══════════════════════════════════════════════════════════
        console.log("── VALIDATION 1: Alert Generation ──────────────────────");
        const g1 = check("token_id exists", !!alert.token_id);
        const g2 = check("alert_triggered is boolean", typeof alert.alert_triggered === "boolean");
        const g3 = check("alert_level exists", !!alert.alert_level);
        const g4 = check("alert_type exists", !!alert.alert_type);
        const g5 = check("primary_warning exists", !!alert.primary_warning);
        const g6 = check("risk_summary exists", !!alert.risk_summary);
        const g7 = check("recommendations is array", Array.isArray(alert.recommendations) && alert.recommendations.length > 0);
        const g8 = check("monitoring_status exists", !!alert.monitoring_status);
        const g9 = check("security_posture exists", !!alert.security_posture);
        const g10 = check("alert_score is numeric", typeof alert.alert_score === "number" && !isNaN(alert.alert_score));
        const g11 = check("ai_confidence passed correctly", alert.ai_confidence === prediction.ai_confidence);
        const g12 = check("agent identifier present", alert.agent === "AntiRug AlertAgent v1");
        results.alert_generation = g1 && g2 && g3 && g4 && g5 && g6 && g7 && g8 && g9 && g10 && g11 && g12;

        // ═══════════════════════════════════════════════════════════
        // VALIDATION 2 — Alert Logic Correctness
        // ═══════════════════════════════════════════════════════════
        console.log("\n── VALIDATION 2: Alert Logic ────────────────────────────");

        const prob = prediction.rug_probability;

        // Expected alert_level based on probability
        let expectedLevel;
        if (prob > 0.75) expectedLevel = "CRITICAL";
        else if (prob > 0.50) expectedLevel = "HIGH";
        else if (prob > 0.30) expectedLevel = "MEDIUM";
        else expectedLevel = "LOW";

        const l1 = check(`alert_level matches probability (prob=${prob} → expect=${expectedLevel}, got=${alert.alert_level})`, alert.alert_level === expectedLevel);

        // Expected trigger status
        const shouldTrigger = prob > 0.40 || riskScore.risk_level === "MEDIUM" || riskScore.risk_level === "HIGH" || riskScore.risk_level === "CRITICAL";
        const l2 = check(`alert_triggered matches rules (expect=${shouldTrigger}, got=${alert.alert_triggered})`, alert.alert_triggered === shouldTrigger);

        // Expected monitoring status
        const expectedMonitoring = prob > 0.40 ? "ACTIVE_MONITORING" : "PASSIVE_MONITORING";
        const l3 = check(`monitoring_status correct (expect=${expectedMonitoring}, got=${alert.monitoring_status})`, alert.monitoring_status === expectedMonitoring);

        // Expected security posture
        let expectedPosture;
        if (prob > 0.75) expectedPosture = "HIGH_RISK";
        else if (prob > 0.50) expectedPosture = "AT_RISK";
        else if (prob > 0.30) expectedPosture = "CAUTION";
        else expectedPosture = "SAFE";
        const l4 = check(`security_posture correct (expect=${expectedPosture}, got=${alert.security_posture})`, alert.security_posture === expectedPosture);

        // Expected alert type
        let expectedType;
        if (expectedLevel === "CRITICAL") expectedType = "CRITICAL_THREAT";
        else if (expectedLevel === "HIGH") expectedType = "SECURITY_WARNING";
        else expectedType = "RISK_MONITOR";
        const l5 = check(`alert_type matches level (expect=${expectedType}, got=${alert.alert_type})`, alert.alert_type === expectedType);

        // Alert score sanity
        const expectedScore = Math.round((riskScore.rug_risk_score + prediction.probability_percent) / 2);
        const l6 = check(`alert_score formula correct (expect=${expectedScore}, got=${alert.alert_score})`, alert.alert_score === expectedScore);

        results.alert_logic = l1 && l2 && l3 && l4 && l5 && l6;

        // ═══════════════════════════════════════════════════════════
        // VALIDATION 3 — Recommendation Engine
        // ═══════════════════════════════════════════════════════════
        console.log("\n── VALIDATION 3: Recommendation Engine ─────────────────");

        const triggers = prediction.key_triggers || [];
        const recsJoined = alert.recommendations.join(" ").toLowerCase();

        let r1 = true, r2 = true, r3 = true;
        if (triggers.includes("Active mint authority")) {
            r1 = check("Mint trigger → recommendation mentions supply monitoring", recsJoined.includes("supply") || recsJoined.includes("mint"));
        } else {
            check("Mint trigger not present — skipping mint recommendation check", true);
        }

        if (triggers.includes("Admin control vulnerability")) {
            r2 = check("Admin trigger → recommendation mentions governance/admin", recsJoined.includes("governance") || recsJoined.includes("admin"));
        } else {
            check("Admin trigger not present — skipping admin recommendation check", true);
        }

        if (triggers.includes("Treasury concentration")) {
            r3 = check("Treasury trigger → recommendation mentions treasury tracking", recsJoined.includes("treasury") || recsJoined.includes("transfer"));
        } else {
            check("Treasury trigger not present — skipping treasury recommendation check", true);
        }

        const r4 = check("Recommendations count between 1–3", alert.recommendations.length >= 1 && alert.recommendations.length <= 3);
        results.recommendation_engine = r1 && r2 && r3 && r4;

        // ═══════════════════════════════════════════════════════════
        // VALIDATION 4 — Severity Mapping
        // ═══════════════════════════════════════════════════════════
        console.log("\n── VALIDATION 4: Severity Mapping ──────────────────────");
        const validLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
        const validTypes = ["RISK_MONITOR", "SECURITY_WARNING", "CRITICAL_THREAT"];
        const validMonitoring = ["ACTIVE_MONITORING", "PASSIVE_MONITORING"];
        const validPostures = ["SAFE", "CAUTION", "AT_RISK", "HIGH_RISK"];

        const s1 = check(`alert_level in valid set (${alert.alert_level})`, validLevels.includes(alert.alert_level));
        const s2 = check(`alert_type in valid set (${alert.alert_type})`, validTypes.includes(alert.alert_type));
        const s3 = check(`monitoring_status in valid set (${alert.monitoring_status})`, validMonitoring.includes(alert.monitoring_status));
        const s4 = check(`security_posture in valid set (${alert.security_posture})`, validPostures.includes(alert.security_posture));
        results.severity_mapping = s1 && s2 && s3 && s4;

        // ═══════════════════════════════════════════════════════════
        // VALIDATION 5 — Edge Case: Degraded Confidence
        // ═══════════════════════════════════════════════════════════
        console.log("\n── VALIDATION 5: Edge Case — Degraded Confidence ──────");
        const degradedAlert = alertAgent.generateAlert({
            risk_score: riskScore,
            prediction: {
                ...prediction,
                ai_confidence: 45
            }
        });

        const e1 = check("Degraded alert still generates (no error)", !degradedAlert.error);
        const e2 = check(`Confidence is lower (45 vs ${prediction.ai_confidence})`, degradedAlert.ai_confidence === 45);
        const e3 = check("Recommendations still valid and non-empty", Array.isArray(degradedAlert.recommendations) && degradedAlert.recommendations.length > 0);
        const e4 = check("No crash with modified confidence", !!degradedAlert.alert_level);

        // Additional edge: empty triggers
        const emptyTriggerAlert = alertAgent.generateAlert({
            risk_score: { ...riskScore, risk_flags: [] },
            prediction: { ...prediction, key_triggers: [], risk_tags: [] }
        });
        const e5 = check("Empty triggers → still generates alert", !emptyTriggerAlert.error);
        const e6 = check("Empty triggers → fallback recommendation provided", emptyTriggerAlert.recommendations.length > 0);

        results.edge_case = e1 && e2 && e3 && e4 && e5 && e6;

        // ═══════════════════════════════════════════════════════════
        // VALIDATION 6 — Stability (no null/NaN/undefined)
        // ═══════════════════════════════════════════════════════════
        console.log("\n── VALIDATION 6: Stability ─────────────────────────────");
        const fields = [
            "token_id", "alert_triggered", "alert_level", "alert_type",
            "primary_warning", "risk_summary", "monitoring_status",
            "security_posture", "alert_score", "ai_confidence", "agent"
        ];
        let allClean = true;
        for (const field of fields) {
            const clean = isCleanValue(alert[field]);
            if (!clean) {
                check(`${field} is clean (no null/NaN/undefined)`, false);
                allClean = false;
            }
        }
        const stab1 = check("All output fields clean (no null/NaN/undefined)", allClean);

        // Check recommendations array elements
        let recsClean = true;
        for (const rec of alert.recommendations) {
            if (!isCleanValue(rec) || typeof rec !== "string" || rec.length === 0) {
                recsClean = false;
                break;
            }
        }
        const stab2 = check("All recommendations are valid non-empty strings", recsClean);

        results.pipeline_integration = stab1 && stab2;

        // ═══════════════════════════════════════════════════════════
        // ERROR HANDLING BONUS — Missing data
        // ═══════════════════════════════════════════════════════════
        console.log("\n── BONUS: Error Handling ────────────────────────────────");
        const missingPred = alertAgent.generateAlert({ risk_score: riskScore });
        check("Missing prediction → returns error", !!missingPred.error);
        const missingScore = alertAgent.generateAlert({ prediction });
        check("Missing risk_score → returns error", !!missingScore.error);
        const nullInput = alertAgent.generateAlert(null);
        check("Null input → returns error, no crash", !!nullInput.error);

        // ═══════════════════════════════════════════════════════════
        // FINAL VALIDATION REPORT
        // ═══════════════════════════════════════════════════════════
        console.log("\n╔══════════════════════════════════════════════════════════════╗");
        console.log("║              ALERT AGENT VALIDATION REPORT                  ║");
        console.log("╠══════════════════════════════════════════════════════════════╣");
        console.log(`║  Alert Generation Working:    ${results.alert_generation ? "PASS ✅" : "FAIL ❌"}                       ║`);
        console.log(`║  Alert Logic Correct:         ${results.alert_logic ? "PASS ✅" : "FAIL ❌"}                       ║`);
        console.log(`║  Recommendation Engine:       ${results.recommendation_engine ? "PASS ✅" : "FAIL ❌"}                       ║`);
        console.log(`║  Severity Mapping Correct:    ${results.severity_mapping ? "PASS ✅" : "FAIL ❌"}                       ║`);
        console.log(`║  Edge Case Handling:          ${results.edge_case ? "PASS ✅" : "FAIL ❌"}                       ║`);
        console.log(`║  Pipeline Integration:        ${results.pipeline_integration ? "PASS ✅" : "FAIL ❌"}                       ║`);
        console.log("╠══════════════════════════════════════════════════════════════╣");

        const allPassed = Object.values(results).every(v => v);
        const status = allPassed ? "AlertAgent READY" : "AlertAgent NEEDS FIXES";
        console.log(`║  Final Status: ${status}${" ".repeat(Math.max(0, 45 - status.length))}║`);
        console.log("╚══════════════════════════════════════════════════════════════╝\n");

    } catch (error) {
        console.error("\n❌ FATAL ERROR DURING INTEGRATION TEST:", error.message || error);
        console.log("\nFinal Status: AlertAgent NEEDS FIXES\n");
    }
}

runAlertAgentPipelineTest();
