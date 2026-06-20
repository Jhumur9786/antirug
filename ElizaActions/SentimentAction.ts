import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import path from "path";
const SentimentAnalysisAgent = require(path.resolve(process.cwd(), "SentimentAnalysisAgent"));
import { ToolDataCache } from "./SharedCache";

export const sentimentAction: Action = {
    name: "FETCH_TOKEN_SENTIMENT",
    similes: ["CHECK_SENTIMENT", "GET_SOCIALS", "CHECK_LIQUIDITY", "FETCH_COMMUNITY_DATA", "GET_GITHUB"],
    description: "Fetches external community sentiment, DEX liquidity, CoinGecko financial fundamentals, and GitHub developer activity for a token.",
    validate: async (runtime: IAgentRuntime, message: Memory) => true,
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback): Promise<any> => {
        const text = message.content?.text || "";
        const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        const tokenId = match ? match[0] : null;

        let symbolMatch = "UNKNOWN";
        if (tokenId && ToolDataCache[tokenId]?.scanner?.name) {
            symbolMatch = ToolDataCache[tokenId].scanner.name.toUpperCase();
        } else {
            const symMatch = text.match(/\b[A-Z]{3,10}\b/);
            if (symMatch) symbolMatch = symMatch[0];
        }

        try {
            if (callback) callback({ text: `*Aggregating Social, Volume, and Liquidity Sentiment for ${symbolMatch}...*` });
            
            const sentAgent = new SentimentAnalysisAgent();
            await Promise.all([
                sentAgent.fetchCoinGeckoData(symbolMatch),
                sentAgent.fetchDexData(symbolMatch),
                sentAgent.fetchGitHubData("https://github.com/solana-labs/solana")
            ]);
            
            const scannerMock = (tokenId && ToolDataCache[tokenId]?.scanner) ? ToolDataCache[tokenId].scanner : { token_id: tokenId, name: symbolMatch, symbol: symbolMatch };
            const sentimentData = await sentAgent.analyzeSentiment(scannerMock);
            
            if (tokenId) {
                ToolDataCache[tokenId] = {
                    ...ToolDataCache[tokenId],
                    sentiment: sentimentData
                };
            }

            const response = `Sentiment & Fundamentals for ${symbolMatch}:
- Social Security Rating: ${sentimentData.sentiment_security_rating}
- DEX Liquidity: $${sentimentData.liquidity_usd}
- 24h Volume: $${sentimentData.volume_24h}
- Dev Activity Risk: ${sentimentData.developer_activity_risk}
- AI Summary: ${sentimentData.ai_sentiment_summary}`;
            
            if (callback) callback({ text: response });
            return true;
        } catch(err: any) {
            if (callback) callback({ text: `Sentiment engine failed: ${err.message}` });
            return false;
        }
    },
    examples: []
};
