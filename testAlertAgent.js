/**
 * AlertAgent Validation Test
 * 
 * Tests the AlertAgent with simulated upstream pipeline data
 * from RiskScoringAgent and RugPredictorAgent.
 */
const AlertAgent = require("./AlertAgent");

const agent = new AlertAgent();

// ── Test 1: Full pipeline data (HIGH RISK token) ───────────────────
console.log("═══════════════════════════════════════════════════════════");
console.log("TEST 1 — HIGH RISK TOKEN");
console.log("═══════════════════════════════════════════════════════════");

const highRiskResult = agent.generateAlert({
    risk_score: {
        token_id: "0.0.2283230",
        rug_risk_score: 72,
        risk_level: "HIGH",
        confidence_score: 85,
        primary_risk_factor: "Mint control risk",
        risk_flags: ["MINT_AUTHORITY_EXISTS", "ADMIN_KEY_PRESENT", "HIGH_HOLDER_CONCENTRATION"],
        recommendations: ["Monitor admin wallet transactions"],
        trend: "DETERIORATING",
        summary: "Token shows high security risk..."
    },
    prediction: {
        token_id: "0.0.2283230",
        rug_probability: 0.62,
        probability_percent: 62,
        probability_level: "ELEVATED",
        ai_confidence: 78,
        risk_trend: "DETERIORATING",
        key_triggers: ["Active mint authority", "Treasury concentration", "Admin control vulnerability"],
        risk_tags: ["CENTRALIZATION_RISK", "ADMIN_CONTROL"],
        risk_simulation: [],
        model_version: "AntiRug AI v2"
    }
});

console.log(JSON.stringify(highRiskResult, null, 2));

// ── Test 2: LOW RISK token ─────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════");
console.log("TEST 2 — LOW RISK TOKEN");
console.log("═══════════════════════════════════════════════════════════");

const lowRiskResult = agent.generateAlert({
    risk_score: {
        token_id: "0.0.1157020",
        rug_risk_score: 18,
        risk_level: "LOW",
        confidence_score: 90,
        primary_risk_factor: "Activity risk",
        risk_flags: [],
        recommendations: ["Standard monitoring of contract activity"],
        trend: "STABLE",
        summary: "Token appears healthy..."
    },
    prediction: {
        token_id: "0.0.1157020",
        rug_probability: 0.15,
        probability_percent: 15,
        probability_level: "LOW",
        ai_confidence: 92,
        risk_trend: "STABLE",
        key_triggers: [],
        risk_tags: ["HEALTHY_SENTIMENT", "MATURE_TOKEN"],
        risk_simulation: [],
        model_version: "AntiRug AI v2"
    }
});

console.log(JSON.stringify(lowRiskResult, null, 2));

// ── Test 3: CRITICAL RISK token ────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════");
console.log("TEST 3 — CRITICAL RISK TOKEN");
console.log("═══════════════════════════════════════════════════════════");

const criticalResult = agent.generateAlert({
    risk_score: {
        token_id: "0.0.9999999",
        rug_risk_score: 91,
        risk_level: "CRITICAL",
        confidence_score: 70,
        primary_risk_factor: "Treasury concentration risk",
        risk_flags: ["MINT_AUTHORITY_EXISTS", "LARGE_TREASURY_RESERVE", "NEW_TOKEN_LISTING", "LOW_LIQUIDITY_WARNING"],
        recommendations: [],
        trend: "DETERIORATING",
        summary: "Critical rug indicators..."
    },
    prediction: {
        token_id: "0.0.9999999",
        rug_probability: 0.88,
        probability_percent: 88,
        probability_level: "HIGH",
        ai_confidence: 65,
        risk_trend: "DETERIORATING",
        key_triggers: ["Treasury concentration", "Low liquidity depth", "Active mint authority"],
        risk_tags: ["CENTRALIZATION_RISK", "LOW_LIQUIDITY", "LOW_ACTIVITY"],
        risk_simulation: [],
        model_version: "AntiRug AI v2"
    }
});

console.log(JSON.stringify(criticalResult, null, 2));

// ── Test 4: Missing prediction data (error handling) ───────────────
console.log("\n═══════════════════════════════════════════════════════════");
console.log("TEST 4 — ERROR HANDLING (missing prediction)");
console.log("═══════════════════════════════════════════════════════════");

const errorResult = agent.generateAlert({ risk_score: { token_id: "0.0.0000000" } });
console.log(JSON.stringify(errorResult, null, 2));

// ── Test 5: Null input (error handling) ────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════");
console.log("TEST 5 — ERROR HANDLING (null input)");
console.log("═══════════════════════════════════════════════════════════");

const nullResult = agent.generateAlert(null);
console.log(JSON.stringify(nullResult, null, 2));

// ── Validation Summary ─────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════");
console.log("VALIDATION SUMMARY");
console.log("═══════════════════════════════════════════════════════════");

const tests = [
    { name: "HIGH RISK",   result: highRiskResult,  expectTriggered: true,  expectLevel: "HIGH",     expectType: "SECURITY_WARNING" },
    { name: "LOW RISK",    result: lowRiskResult,    expectTriggered: false, expectLevel: "LOW",      expectType: "RISK_MONITOR" },
    { name: "CRITICAL",    result: criticalResult,   expectTriggered: true,  expectLevel: "CRITICAL", expectType: "CRITICAL_THREAT" },
    { name: "ERROR (no prediction)", result: errorResult, expectError: true },
    { name: "ERROR (null)",          result: nullResult,  expectError: true }
];

let passed = 0;
tests.forEach(t => {
    if (t.expectError) {
        const ok = !!t.result.error;
        console.log(`  ${ok ? "✅" : "❌"} ${t.name}: error=${t.result.error}`);
        if (ok) passed++;
    } else {
        const levelOk   = t.result.alert_level === t.expectLevel;
        const triggerOk  = t.result.alert_triggered === t.expectTriggered;
        const typeOk     = t.result.alert_type === t.expectType;
        const recsOk     = Array.isArray(t.result.recommendations) && t.result.recommendations.length > 0;
        const agentOk    = t.result.agent === "AntiRug AlertAgent v1";
        const allOk      = levelOk && triggerOk && typeOk && recsOk && agentOk;
        console.log(`  ${allOk ? "✅" : "❌"} ${t.name}: level=${t.result.alert_level} triggered=${t.result.alert_triggered} type=${t.result.alert_type} recs=${t.result.recommendations.length} score=${t.result.alert_score}`);
        if (allOk) passed++;
    }
});

console.log(`\n  Result: ${passed}/${tests.length} tests passed`);
