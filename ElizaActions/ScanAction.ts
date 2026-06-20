import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import path from "path";
const TokenScannerAgent = require(path.resolve(process.cwd(), "TokenScannerAgent"));
const BlockchainRiskAnalysisAgent = require(path.resolve(process.cwd(), "BlockchainRiskAnalysisAgent"));
import { ToolDataCache } from "./SharedCache";

export const scanTokenAction: Action = {
    name: "SCAN_TOKEN_ONCHAIN",
    similes: ["GET_TOKEN_DATA", "FETCH_TOKEN_CONFIG", "CHECK_ADMIN_KEYS", "ONCHAIN_SCAN"],
    description: "Fetches on-chain token configuration (mint keys, admin keys, supply) and analyzes immediate blockchain risks.",
    validate: async (runtime: IAgentRuntime, message: Memory) => true,
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback): Promise<any> => {
        const text = message.content?.text || "";
        const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        if (!match) {
            if (callback) callback({ text: "Please specify a valid Solana token address to scan." });
            return false;
        }
        const tokenId = match[0];
        
        try {
            if (callback) callback({ text: `*Running On-Chain Scanner for ${tokenId}*...` });
            
            const scanner = new TokenScannerAgent();
            const scannerData = await scanner.scan(tokenId);
            
            const bcAgent = new BlockchainRiskAnalysisAgent();
            const bcRisk = bcAgent.analyzeTokenRisk(scannerData);
            
            // Save to shared tool cache
            ToolDataCache[tokenId] = {
                ...ToolDataCache[tokenId],
                scanner: scannerData,
                blockchain: bcRisk
            };

            const response = `On-Chain Scan Complete for ${scannerData.name || tokenId}:
- Mint Key: ${scannerData.has_mint_authority ? "Enabled! (Risk)" : "Disabled (Safe)"}
- Admin Key: ${scannerData.has_admin_key ? "Enabled! (Risk)" : "Disabled (Safe)"}
- Mint Risk Score: ${bcRisk.mint_risk_score}
- Admin Control Score: ${bcRisk.admin_control_score}
- Overall Blockchain Risk: ${bcRisk.admin_control_risk}`;
            
            if (callback) callback({ text: response });
            return true;
        } catch(err: any) {
            if (callback) callback({ text: `Scanner failed: ${err.message}` });
            return false;
        }
    },
    examples: []
};
