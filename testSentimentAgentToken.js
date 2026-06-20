const SentimentAnalysisAgent = require("./SentimentAnalysisAgent");

const agent = new SentimentAnalysisAgent();

const scannerData = {
  token_id: "0.0.2283230",
  name: "Karate Combat",
  symbol: "KARATE",
  network: "solana"
};

async function runTest() {
  try {
    console.log("===== RUNNING SENTIMENT INTELLIGENCE TEST =====");
    console.log("Token: HSUITE");
    
    const result = await agent.analyzeSentiment(scannerData);
    
    console.log("===== SENTIMENT INTELLIGENCE REPORT =====");
    console.log(JSON.stringify(result, null, 2));
    
    if (result.community_intelligence_score) {
      console.log("SUCCESS: Intelligence engine operational");
    }
    
    console.log("===== TEST COMPLETE =====");
  } catch (error) {
    console.log("TEST FAILED");
    console.error(error);
  }
}

runTest();
