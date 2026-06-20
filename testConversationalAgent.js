require("dotenv").config();
const ConversationalAgent = require("./ConversationalAgent");

const mockReport1 = {
    token_name: "SAUCE",
    token_id: "0.0.731861",
    rug_risk_score: 42,
    risk_level: "Low",
    agent_data: {
        blockchain_risk: {
            mint_risk_score: 95,
            admin_control_score: 80
        },
        sentiment: {
            liquidity_usd: 1500000,
            community_risk_index: 33
        }
    }
};

const mockReport2 = {
    token_name: "Karate",
    token_id: "0.0.2283230",
    rug_risk_score: 53,
    risk_level: "Medium",
    agent_data: {
        blockchain_risk: {
            mint_risk_score: 90,
            admin_control_score: 85
        },
        sentiment: {
            liquidity_usd: 500000,
            community_risk_index: 59
        }
    }
};

async function testAgent() {
    const agent = new ConversationalAgent();
    console.log("🧪 Testing ConversationalAgent Prompt (Multi-token comparison)...\n");
    
    const userMessage = "Compare the risk profiles of SAUCE and Karate";
    console.log(`User Input: "${userMessage}"\n`);
    console.log("Generating response (this may take a few seconds)...\n");
    console.log("------------------------");
    
    const history = [];
    const pipelineData = [mockReport1, mockReport2];
    
    try {
        const response = await agent.chat(userMessage, history, pipelineData);
        console.log("🤖 AntiRug Advisor:\n\n" + response.message);
        console.log("\n------------------------");
    } catch (e) {
        console.error("Error running test:", e);
    }
}

testAgent();
