const askLLM = require("./llmClient");
const { resolveLLMModel } = require("./llmConfig");

/**
 * ExpertConsensusAgent — TRUE MULTI-AGENT DEBATE MODE ⚔️ (OPTIMIZED)
 * 
 * Includes Model Tiering, Promise.allSettled fault tolerance, 
 * Strict Token Limits to prevent context bloat, and JSON Mode for data integrity.
 * NOW INCLUDES: On-Chain Forensics Expert 🕵️
 */
class ExpertConsensusAgent {
    constructor() {
        this.name = "ExpertConsensusAgent_OptimizedDebate";
    }

    async generateConsensus(pipelineReport) {
        if (!pipelineReport || !pipelineReport.agent_data) {
            throw new Error("Missing pipeline data for consensus analysis.");
        }

        const ad = pipelineReport.agent_data;
        const tokenId = pipelineReport.token_id;
        const tokenName = pipelineReport.token_name;

        // Base facts
        const primaryRisk = pipelineReport.primary_risk || "Unknown";
        const riskScore = pipelineReport.rug_risk_score || 0;
        const probability = pipelineReport.predicted_probability || 0;

        const baseContext = `
Token: ${tokenName} (${tokenId})
Primary Risk: ${primaryRisk}
Composite Risk Score: ${riskScore}/100
Rug Pull Probability: ${probability}%

INITIAL PIPELINE FINDINGS:
- Sentiment Data: ${ad.sentiment?.ai_sentiment_summary || "None"}
- Structural Risk Data: ${ad.risk_score?.ai_risk_summary || "None"}
- Quant Data: ${ad.prediction?.ai_prediction_summary || "None"}
`;

        try {
            console.log(`\n🚨 [Optimized M-A Debate] Initializing Board of Directors (4 Agents) for ${tokenName}...`);
            
            // Helper to extract fulfilled text and handle failures gracefully
            const unwrap = (result, name) => result.status === 'fulfilled' ? result.value : `[${name} failed to respond due to network error]`;
            
            // Shared lightweight options for the arguing experts
            const expertOpts = { model: resolveLLMModel("small"), max_tokens: 60, timeout: 8000, throwOnError: true };

            // ==========================================
            // ROUND 1: INDEPENDENT ANALYSIS (Parallel, Fault Tolerant)
            // ==========================================
            console.log("🗣️ [Optimized M-A Debate] ROUND 1: Experts formulating independent opinions...");
            const r1Results = await Promise.allSettled([
                askLLM(`You are the SENTIMENT EXPERT on the board. You prioritize community hype. Analyze the data below and give your unvarnished take in 1 sentence.\n\n${baseContext}`, expertOpts),
                askLLM(`You are the STRUCTURAL RISK EXPERT on the board. You are paranoid and focus entirely on tokenomics/keys. Analyze the data below and give your unvarnished take in 1 sentence.\n\n${baseContext}`, expertOpts),
                askLLM(`You are the QUANTITATIVE MODELER. Analyze the probability scores below and give your unvarnished take in 1 sentence.\n\n${baseContext}`, expertOpts),
                askLLM(`You are the ON-CHAIN FORENSICS EXPERT. You track smart contract transactions, insider wallets, and liquidity to see if insiders are holding the supply. Analyze the data below and give your unvarnished take in 1 sentence.\n\n${baseContext}`, expertOpts)
            ]);

            const sentimentOpinion = unwrap(r1Results[0], "Sentiment Expert");
            const riskOpinion      = unwrap(r1Results[1], "Risk Expert");
            const quantOpinion     = unwrap(r1Results[2], "Quant Expert");
            const forensicsOpinion = unwrap(r1Results[3], "Forensics Expert");

            const round1History = `
--- DEBATE ROOM (ROUND 1) ---
SENTIMENT EXPERT: ${sentimentOpinion}
RISK EXPERT: ${riskOpinion}
QUANT MODELER: ${quantOpinion}
FORENSICS EXPERT: ${forensicsOpinion}
`;

            // ==========================================
            // ROUND 2: REBUTTALS (Parallel, Fault Tolerant)
            // ==========================================
            console.log("⚔️ [Optimized M-A Debate] ROUND 2: Experts cross-examining each other...");
            const r2Results = await Promise.allSettled([
                askLLM(`You are the SENTIMENT EXPERT. Defend your data against the other experts. Provide your final 1-sentence verdict.\n\n${baseContext}\n${round1History}`, expertOpts),
                askLLM(`You are the RISK EXPERT. Rip apart the Sentiment expert's logic if they are trusting dangerous hype. Provide your final 1-sentence verdict.\n\n${baseContext}\n${round1History}`, expertOpts),
                askLLM(`You are the QUANT MODELER. Correct any emotional biases using the strict probability scores. Provide your final 1-sentence verdict.\n\n${baseContext}\n${round1History}`, expertOpts),
                askLLM(`You are the FORENSICS EXPERT. Warn the other experts if the tokenomics or liquidity data looks like an insider setup or honeypot. Provide your final 1-sentence verdict.\n\n${baseContext}\n${round1History}`, expertOpts)
            ]);

            const sentimentRebuttal = unwrap(r2Results[0], "Sentiment Expert");
            const riskRebuttal      = unwrap(r2Results[1], "Risk Expert");
            const quantRebuttal     = unwrap(r2Results[2], "Quant Expert");
            const forensicsRebuttal = unwrap(r2Results[3], "Forensics Expert");

            const fullDebateHistory = `
${round1History}
--- DEBATE ROOM (ROUND 2 - REBUTTALS) ---
SENTIMENT EXPERT: ${sentimentRebuttal}
RISK EXPERT: ${riskRebuttal}
QUANT MODELER: ${quantRebuttal}
FORENSICS EXPERT: ${forensicsRebuttal}
`;

            // ==========================================
            // FINAL VERDICT: THE MODERATOR (json_object mode)
            // ==========================================
            console.log("⚖️ [Optimized M-A Debate] FINAL VERDICT: Moderator synthesizing the debate...");
            const moderatorPrompt = `
You are the EXECUTIVE MODERATOR for the Security Board.
Read the full multi-agent debate history below:

${fullDebateHistory}

TASK:
1. Resolve the conflicting arguments between the experts (Sentiment, Risk, Quant, Forensics) based on the debate transcript.
2. Reach a UNIFIED expert verdict.

RETURN JSON OBJECT WITH EXACT EXACTLY THESE KEYS:
"consensus_verdict": string ("CRITICAL", "DANGEROUS", "CAUTION", or "STABLE")
"conflict_analysis": string (how you resolved the contradictions)
"expert_deliberation": string (summary of the joint expert opinion in 3 sentences)
"final_recommendation": string (action plan)
"confidence_rating": number (0 to 100)
`;

            // Use the configured large model for complex JSON validation and synthesis.
            const responseText = await askLLM(moderatorPrompt, { 
                model: resolveLLMModel("large"),
                max_tokens: 350, 
                timeout: 20000,
                response_format: { type: "json_object" } 
            });

            const consensusData = JSON.parse(responseText);

            console.log(`✅ [Optimized M-A Debate] Verdict Reached: ${consensusData.consensus_verdict}`);

            return {
                ...consensusData,
                status: "CONSENSUS_REACHED",
                timestamp: new Date().toISOString(),
                raw_debate_log: fullDebateHistory
            };

        } catch (error) {
            console.error("[ExpertConsensus] Failed to reach consensus:", error.message);
            return {
                consensus_verdict: "UNKNOWN",
                conflict_analysis: "Consensus deliberation failed due to system error.",
                expert_deliberation: "The expert board was unable to reach a unified conclusion.",
                final_recommendation: "Hold for fresh manual review.",
                confidence_rating: 0,
                status: "CONSENSUS_ERROR"
            };
        }
    }
}

module.exports = ExpertConsensusAgent;
