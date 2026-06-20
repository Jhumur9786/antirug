import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";

// Import our existing native Node.js mathematical risk engines!
const TokenScannerAgent = require("./TokenScannerAgent");
const SentimentAnalysisAgent = require("./SentimentAnalysisAgent");
const BlockchainRiskAnalysisAgent = require("./BlockchainRiskAnalysisAgent");
const RiskScoringAgent = require("./RiskScoringAgent");
const RugPredictorAgent = require("./RugPredictorAgent");
const AlertAgent = require("./AlertAgent");

export const analyzeTokenAction: Action = {
    name: "ANALYZE_TOKEN_RISK",
    similes: ["CHECK_RUG", "ANALYZE", "ASSESS_DANGER", "RUG_CHECK", "SCAN_TOKEN"],
    description: "Triggers a full mathematical risk analysis on a Solana token to calculate rug pull probability and security alerts.",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content?.text || "";
        return /(analyze|check|risk|rug).*([1-9A-HJ-NP-Za-km-z]{32,44})/i.test(text);
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback): Promise<any> => {
        const text = message.content?.text || "";
        const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        if (!match) return false;
        const tokenId = match[0];

        try {
            // Provide immediate feedback since analysis takes ~5-10 seconds
            if (callback) callback({ text: `*Intercepting token ${tokenId}*. Initiating full mathematical security pipeline...` });

            // 1. Data Ingestion
            const scanner = new TokenScannerAgent();
            const scannerData = await scanner.scan(tokenId);
            
            const sentAgent = new SentimentAnalysisAgent();
            // Try to extract symbol or default
            const symbolMatch = scannerData.name ? scannerData.name.toUpperCase() : "UNKNOWN";
            await Promise.all([
                sentAgent.fetchCoinGeckoData(symbolMatch),
                sentAgent.fetchDexData(symbolMatch),
                sentAgent.fetchGitHubData("https://github.com/solana-labs/solana")
            ]);
            // Sentiment requires analyze() to get the AI summary using the old llmClient
            const sentimentData = await sentAgent.analyzeSentiment(scannerData);

            // 2. Deterministic Blockchain Risk
            const bcAgent = new BlockchainRiskAnalysisAgent();
            const bcRisk = bcAgent.analyzeTokenRisk(scannerData);

            // 3. Risk Scoring
            const riskAgent = new RiskScoringAgent();
            const riskScore = await riskAgent.calculateRisk({
                scanner: scannerData,
                blockchain: bcRisk,
                sentiment: sentimentData
            });

            // 4. Rug Prediction
            const predAgent = new RugPredictorAgent();
            const prediction = await predAgent.predictRisk({
                scanner: scannerData,
                blockchain_risk: bcRisk,
                sentiment: sentimentData,
                risk_score: riskScore
            });

            // 5. Final Alert
            const alertAgent = new AlertAgent();
            const alert = await alertAgent.generateAlert({
                risk_score: riskScore,
                prediction: prediction
            });

            // 6. 🚨 OPENCONVAI HCS-10 DECENTRALIZED SIREN BROADCAST
            if (prediction.rug_probability > 75) {
                const criticalIssue = bcRisk.mint_risk_level === "CRITICAL" ? "Centralized Minting Authority Detected" : alert.security_posture;
                if (OpenConvAIClient.instance) {
                    await OpenConvAIClient.instance.broadcastGlobalAlert(tokenId, prediction.rug_probability, criticalIssue);
                }
            }

            // Construct the final conversational payload Eliza will output
            const finalMessage = `
**SECURITY INTELLIGENCE REPORT: ${scannerData.name || "Unknown"} (${tokenId})**
─────────────────────────────────────────────
* **Rug Pull Risk Score:** ${riskScore.rug_risk_score}/100 (${riskScore.risk_level})
* **Predicted Probability:** ${prediction.rug_probability}% (${prediction.prediction_strength})
* **Overall Posture:** ${alert.security_posture}
* **Admin Control:** ${bcRisk.admin_control_risk} | **Mint Risk:** ${bcRisk.mint_risk_level}

**AI Risk Assessment:**
${riskScore.ai_risk_summary}

**Predicted Scenarios:**
${prediction.ai_risk_scenario}

**Actionable Recommendations:**
${alert.recommendations?.map((r: string) => `- ${r}`).join('\n')}
`;
            
            if (callback) callback({ text: finalMessage.trim() });
            return true;

        } catch (error: any) {
            runtime.logger.error(`[AnalyzeTokenAction] Error: ${error.message}`);
            if (callback) callback({ text: `I encountered a critical error while executing the security pipeline for ${tokenId}: ${error.message}` });
            return false;
        }
    },
    examples: []
};
