import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import path from "path";
const SentimentAnalysisAgent = require(path.resolve(process.cwd(), "SentimentAnalysisAgent"));

export const sentimentProvider: Provider = {
    name: "SENTIMENT_PROVIDER",
    get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<any> => {
        try {
            // Check if conversation implies token analysis intent
            const text = message.content?.text?.toLowerCase() || "";
            const isAnalysis = text.includes("analyze") || text.includes("risk") || text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
            
            if (!isAnalysis) {
                return "";
            }

            // A real ELIZA integration usually parses out the specific token symbol here.
            // For now, we simulate fetching the scanner data. In Eliza, state.providers 
            // runs sequentially, so we might need state.token_data if stored.
            // We'll run the sentiment engine generically or extract the token name if known.
            
            runtime.logger.info("[SentimentProvider] Fetching Web3 sentiment intelligence...");
            
            // Re-utilize our pure Node.js sentiment API fetchers!
            const sentAgent = new SentimentAnalysisAgent();
            
            // To run this standalone without the scanner, we just fetch standard symbols
            // If the user says "Sauce", we catch it.
            let tokenSymbol = "UNKNOWN";
            if (text.includes("sauce")) tokenSymbol = "SAUCE";
            else if (text.includes("karate")) tokenSymbol = "KARATE";
            else if (text.includes("grelf")) tokenSymbol = "GRELF";

            await Promise.all([
                sentAgent.fetchCoinGeckoData(tokenSymbol),
                sentAgent.fetchDexData(tokenSymbol),
                sentAgent.fetchGitHubData("https://github.com/solana-labs/solana")
            ]);
            
            // Return raw state strings to inject into the Eliza agent's working memory
            return `
=== SOCIAL & MARKET INTELLIGENCE ===
Token: ${tokenSymbol}
CoinGecko Sentiment: ${sentAgent.socialState.reddit_sentiment} (Reddit), ${sentAgent.socialState.twitter_sentiment} (Twitter)
DEX Metric: ${sentAgent.socialState.dex_volume_usd} / Liquidity: ${sentAgent.socialState.dex_liquidity_usd}
Developer Commits: ${sentAgent.socialState.developer_activity_score}
====================================
`;
        } catch (error: any) {
            runtime.logger.error(`[SentimentProvider] Error: ${error.message}`);
            return "";
        }
    }
};
