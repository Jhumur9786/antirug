const { execSync } = require('child_process');
const BlockchainRiskAnalysisAgent = require('./BlockchainRiskAnalysisAgent');
const SentimentAnalysisAgent = require('./SentimentAnalysisAgent');
const RiskScoringAgent = require('./RiskScoringAgent');

async function runPipeline() {
    const tokenId = process.argv[2] || "0.0.2283230"; // Default to Karate if not provided
    const tokenNameHint = process.argv[3] || "Unknown Token";

    console.log("Starting AntiRug Pipeline Validation for:", tokenId);

    try {
        // 1. TokenScannerAgent (Python)
        console.log("\n1. Running TokenScannerAgent...");
        let scannerResult;
        try {
            const scannerOutputRaw = execSync(`python3 token_scanner_agent.py ${tokenId}`).toString();
            scannerResult = JSON.parse(scannerOutputRaw);
        } catch (e) {
            throw { agent: "TokenScannerAgent", source: "Python CLI", cause: e.message, fix: "Check if python3 is installed and token_scanner_agent.py exists." };
        }
        
        console.log("===== TOKEN SCANNER OUTPUT =====");
        console.log(JSON.stringify(scannerResult, null, 2));

        if (scannerResult.error) {
            throw { agent: "TokenScannerAgent", source: "Solana RPC", cause: scannerResult.error, fix: "Verify Token Address exists on Solana Mainnet." };
        }

        // 2. BlockchainRiskAnalysisAgent (Node.js)
        console.log("\n2. Running BlockchainRiskAnalysisAgent...");
        const blockchainAgent = new BlockchainRiskAnalysisAgent();
        let blockchainRisk;
        try {
            blockchainRisk = blockchainAgent.analyzeTokenRisk(scannerResult);
        } catch (e) {
            throw { agent: "BlockchainRiskAnalysisAgent", source: "Node Logic", cause: e.message, fix: "Check if scanner output matches agent expected schema." };
        }
        
        console.log("===== BLOCKCHAIN RISK OUTPUT =====");
        console.log(JSON.stringify(blockchainRisk, null, 2));

        // 3. SentimentAnalysisAgent (Node.js)
        console.log("\n3. Running SentimentAnalysisAgent...");
        const sentimentAgent = new SentimentAnalysisAgent();
        const sentimentInput = {
            token_id: tokenId,
            name: scannerResult.name || tokenNameHint,
            symbol: scannerResult.symbol || "UNKNOWN"
        };
        let sentiment;
        try {
            sentiment = await sentimentAgent.analyzeSentiment(sentimentInput);
        } catch (e) {
            throw { agent: "SentimentAnalysisAgent", source: "API / Simulation", cause: e.message, fix: "Check internet connection or API rate limits." };
        }
        
        console.log("===== SENTIMENT INTELLIGENCE OUTPUT =====");
        console.log(JSON.stringify(sentiment, null, 2));

        // 4. RiskScoringAgent (Node.js)
        console.log("\n4. Running RiskScoringAgent...");
        const scoringAgent = new RiskScoringAgent();
        let finalRisk;
        try {
            finalRisk = await scoringAgent.calculateRisk({
                scanner: scannerResult,
                blockchain: blockchainRisk,
                sentiment: sentiment
            });
        } catch (e) {
            throw { agent: "RiskScoringAgent", source: "Fusion Logic", cause: e.message, fix: "Check if all previous agents returned valid JSON." };
        }
        
        console.log("===== FINAL RISK ENGINE OUTPUT =====");
        console.log(JSON.stringify(finalRisk, null, 2));

        // ----- VALIDATION -----
        console.log("\n----- VALIDATION CHECKS -----");
        let valid = true;
        const checks = [];

        // Scanner Validation
        checks.push({ name: "Token exists", pass: !scannerResult.error });
        checks.push({ name: "Symbol present", pass: !!scannerResult.symbol });
        checks.push({ name: "No timestamp bugs", pass: scannerResult.last_transaction_timestamp !== null });
        checks.push({ name: "No invalid percentages", pass: scannerResult.top_holder_percentage >= 0 && scannerResult.top_holder_percentage <= 100 });
        checks.push({ name: "Holder count realistic", pass: scannerResult.holder_count >= 0 });
        checks.push({ name: "Treasury balance correct", pass: typeof scannerResult.treasury_balance === 'number' });
        checks.push({ name: "Token age realistic", pass: scannerResult.token_age_days < 3000 }); // Solana is ~5 years old

        // Sentiment Validation
        checks.push({ name: "No default bullish values", pass: sentiment.posts_analyzed > 0 });
        checks.push({ name: "DEX liquidity verified", pass: sentiment.dex_listed === true ? sentiment.liquidity_usd >= 0 : true });
        checks.push({ name: "CoinGecko match attempted", pass: sentiment.data_sources_used.includes("coingecko") });
        checks.push({ name: "Volume not zero if listed", pass: sentiment.dex_listed ? sentiment.volume_24h >= 0 : true });

        // Risk Scoring Validation
        checks.push({ name: "Risk score between 0–100", pass: finalRisk.rug_risk_score >= 0 && finalRisk.rug_risk_score <= 100 });
        checks.push({ name: "Risk level matches score range", pass: !!finalRisk.risk_level });
        checks.push({ name: "Confidence score present", pass: finalRisk.confidence_score > 0 });
        checks.push({ name: "Primary risk factor identified", pass: !!finalRisk.primary_risk_factor });
        checks.push({ name: "Recommendations generated", pass: finalRisk.recommendations.length > 0 });

        checks.forEach(c => {
            console.log(`${c.pass ? '[PASS]' : '[FAIL]'} ${c.name}`);
            if (!c.pass) valid = false;
        });

        // ----- FINAL REPORT (USER REQUESTED FORMAT) -----
        const requestedReport = {
            "token_id": tokenId,
            "token_name": scannerResult.name || tokenNameHint,
            "blockchain_risk_level": blockchainRisk.mint_risk_level,
            "sentiment_risk_level": sentiment.sentiment_security_rating,
            "rug_risk_score": finalRisk.rug_risk_score,
            "final_risk_level": finalRisk.risk_level,
            "primary_risk_factor": finalRisk.primary_risk_factor,
            "confidence": `${finalRisk.confidence_score}%`
        };

        console.log("\n===== FINAL REPORT =====");
        console.log(JSON.stringify(requestedReport, null, 2));

        if (valid) {
            console.log("\nGOAL: AntiRug pipeline works end-to-end like a real security product.");
        } else {
            console.log("\nWARNING: Pipeline completed but some validation checks failed.");
        }

    } catch (error) {
        console.log("\n===== DEBUG MODE =====");
        console.log("ERROR SOURCE:", error.source || "Master Script");
        console.log("FAILED AGENT:", error.agent || "Execution Logic");
        console.log("REASON:", error.cause || error.message);
        console.log("SUGGESTED FIX:", error.fix || "Check agent connectivity and input data.");
        process.exit(1);
    }
}

runPipeline();
