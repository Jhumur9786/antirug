import "dotenv/config";
import { AntiRugElizaRuntime } from "./dist/eliza-runtime.mjs";

async function testEliza() {
    const eliza = new AntiRugElizaRuntime();
    console.log("🧪 Testing ElizaOS Chat directly...\n");
    
    const userMessage = "Compare the risk profiles of 0.0.731861 and 0.0.2283230";
    console.log(`User Input: "${userMessage}"\n`);
    console.log("Generating response (this triggers the full pipeline analysis & synthesis)...");
    console.log("------------------------");
    
    try {
        const reply = await eliza.executeChat("test-session-123", userMessage);
        console.log("🤖 AntiRug (ElizaOS):\n\n" + reply);
        console.log("\n------------------------");
    } catch (e) {
        console.error("Error running Eliza test:", e);
    }
}

testEliza();
