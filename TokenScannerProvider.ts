import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import path from "path";
const TokenScannerAgent = require(path.resolve(process.cwd(), "TokenScannerAgent"));

export const tokenScannerProvider: Provider = {
    name: "TOKEN_SCANNER_PROVIDER",
    get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<any> => {
        try {
            // Extract token address closely matching Solana base58 from the message
            const text = message.content?.text || "";
            const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
            
            if (!match) {
                return ""; // No token ID detected in the conversation turn
            }
            
            const tokenId = match[0];
            runtime.logger.info(`[TokenScannerProvider] Intercepted token ID ${tokenId}. Initiating RPC scan...`);

            // Utilize existing heavily-optimized JS logic
            const scanner = new TokenScannerAgent();
            const data = await scanner.scan(tokenId);
            
            // Eliza Providers must return strings containing context to inject before the LLM thinks
            return `
=== SOLANA RPC RAW DATA (TOKEN SCANNER) ===
${JSON.stringify(data, null, 2)}
===================================================
`;
        } catch (error: any) {
            runtime.logger.error(`[TokenScannerProvider] Error: ${error.message}`);
            return `Scanner System Error: Could not fetch data for token. Reason: ${error.message}`;
        }
    }
};
