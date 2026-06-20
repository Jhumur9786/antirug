require("dotenv").config();
const { execSync } = require('child_process');
const BlockchainRiskAnalysisAgent = require('./BlockchainRiskAnalysisAgent');
const SentimentAnalysisAgent = require('./SentimentAnalysisAgent');
const RiskScoringAgent = require('./RiskScoringAgent');
const RugPredictorAgent = require('./RugPredictorAgent');
const AlertAgent = require('./AlertAgent');
const ExpertConsensusAgent = require('./ExpertConsensusAgent');

async function runDeepForToken(tokenId) {
    console.log(`\n\n=== RUNNING PIPELINE FOR ${tokenId} ===`);
    const raw = execSync(`python3 token_scanner_agent.py ${tokenId}`, { cwd: __dirname }).toString().trim();
    const scanner = JSON.parse(raw);
    
    // Fallback if scanner fails
    if (scanner.error) {
        throw new Error(`Scanner error for ${tokenId}: ` + scanner.error);
    }
    
    const blockchainAgent = new BlockchainRiskAnalysisAgent();
    const blockchainRisk = blockchainAgent.analyzeTokenRisk(scanner);
    
    const sentimentAgent = new SentimentAnalysisAgent();
    let sentiment;
    try {
        sentiment = await sentimentAgent.analyzeSentiment({
            token_id: tokenId,
            name: scanner.name || "Unknown",
            symbol: scanner.symbol || "UNKNOWN"
        });
    } catch(err) {
        console.warn(`Sentiment error for ${tokenId}:`, err.message);
        sentiment = {
            token_id: tokenId,
            sentiment_security_rating: "UNKNOWN",
            community_risk_index: 50,
            bullish_percentage: 0,
            bearish_percentage: 0,
            ai_sentiment_summary: "No data available due to error."
        };
    }
    
    const scoringAgent = new RiskScoringAgent();
    const riskScore = await scoringAgent.calculateRisk({ scanner, blockchain: blockchainRisk, sentiment });
    
    const predictorAgent = new RugPredictorAgent();
    const prediction = await predictorAgent.predictRisk({
        scanner, blockchain_risk: blockchainRisk, sentiment, risk_score: riskScore
    });
    
    const alertAgent = new AlertAgent();
    const alert = await alertAgent.generateAlert({ risk_score: riskScore, prediction });
    
    const pipelineReport = {
        token_id: tokenId,
        token_name: scanner.name,
        primary_risk: riskScore.primary_risk_factor,
        rug_risk_score: riskScore.rug_risk_score,
        predicted_probability: prediction.rug_probability,
        agent_data: { scanner, blockchain_risk: blockchainRisk, sentiment, risk_score: riskScore, prediction, alert }
    };
    
    const consensusAgent = new ExpertConsensusAgent();
    const consensus = await consensusAgent.generateConsensus(pipelineReport);
    
    return { token: scanner.name, riskScore: riskScore.rug_risk_score, probability: prediction.rug_probability, consensus };
}

async function main() {
    try {
        const res1 = await runDeepForToken("0.0.731861");
        const res2 = await runDeepForToken("0.0.2283230");
        
        console.log("\n\n==== COMPARISON REPORT ====");
        console.log(JSON.stringify({ "0.0.731861": res1, "0.0.2283230": res2 }, null, 2));
    } catch (err) {
        console.error("Error during comparison:", err);
    }
}

main();
