"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenConvAIClient = void 0;
class OpenConvAIClient {
    constructor(runtime) {
        this.inboundTopicId = null;
        this.globalSirenTopicId = null;
        // Micro-monetization: minimum HBAR fee for analysis requests
        this.ANALYSIS_FEE_HBAR = 1;
        // Track processed requests to avoid duplicates
        this.processedRequests = new Set();
        this.runtime = runtime;
        OpenConvAIClient.instance = this;
    }
    async start() {
        this.runtime.logger.info("🟢 Deploying RugGuard onto OpenConvAI (HCS-10)...");
        if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
            this.runtime.logger.warn("🟡 Missing Hedera ENV keys. Cannot connect to HCS-10 network.");
            return;
        }
        try {
            const sdk = await import("@hashgraphonline/standards-sdk");
            const { HCS10Client } = sdk;
            const { InboundTopicType } = sdk;
            this.hcsClient = new HCS10Client({
                network: "testnet",
                operatorId: process.env.HEDERA_ACCOUNT_ID,
                operatorPrivateKey: process.env.HEDERA_PRIVATE_KEY
            });
            // Generate RugGuard's autonomous inbox topic on Hedera
            // SDK signature: createInboundTopic(accountId, topicType, ttl?)
            const response = await this.hcsClient.createInboundTopic(process.env.HEDERA_ACCOUNT_ID, InboundTopicType.CONTROLLED, 86400);
            this.inboundTopicId = typeof response === "string" ? response : (response.topicId?.toString() || response.toString());
            this.runtime.logger.info(`====================================================`);
            this.runtime.logger.info(`✅ OPENCONVAI AGENT SUCCESSFULLY REGISTERED!`);
            this.runtime.logger.info(`📡 My HCS Topic Inbox is: ${this.inboundTopicId}`);
            // Set up our public Global Alerts Topic (Siren)
            const sirenResp = await this.hcsClient.createInboundTopic(process.env.HEDERA_ACCOUNT_ID, InboundTopicType.PUBLIC, 86400);
            this.globalSirenTopicId = typeof sirenResp === "string" ? sirenResp : (sirenResp.topicId?.toString() || sirenResp.toString());
            this.runtime.logger.info(`🚨 GLOBAL SECURITY SIREN HCS TOPIC is: ${this.globalSirenTopicId}`);
            this.runtime.logger.info(`💰 Micro-Monetization ACTIVE: Other agents must pay ≥${this.ANALYSIS_FEE_HBAR} HBAR for analysis.`);
            this.runtime.logger.info(`🤖 Other AI Agents can now ping me for Rug Risk analysis!`);
            this.runtime.logger.info(`====================================================`);
            // Start listening loop
            this.pollInbox();
        }
        catch (error) {
            this.runtime.logger.error(`❌ OpenConvAI Init Error: ${error.message}`);
        }
    }
    // ═══════════════════════════════════════════════════
    //  FEATURE 4: MICRO-MONETIZATION INBOX LISTENER
    // ═══════════════════════════════════════════════════
    pollInbox() {
        setInterval(async () => {
            if (!this.inboundTopicId || !this.hcsClient)
                return;
            try {
                // Attempt to read messages from our inbox topic
                const messages = await this.fetchInboxMessages();
                for (const msg of messages) {
                    if (this.processedRequests.has(msg.id))
                        continue;
                    this.processedRequests.add(msg.id);
                    await this.handleIncomingRequest(msg);
                }
            }
            catch {
                // Silent fail — inbox polling is best-effort
            }
        }, 30000);
    }
    /**
     * Fetch messages from the HCS inbox topic via Mirror Node
     */
    async fetchInboxMessages() {
        if (!this.inboundTopicId)
            return [];
        try {
            const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${this.inboundTopicId}/messages?limit=5&order=desc`);
            if (!response.ok)
                return [];
            const data = await response.json();
            return (data.messages || []).map((m) => {
                let content = {};
                try {
                    const decoded = Buffer.from(m.message, "base64").toString("utf-8");
                    content = JSON.parse(decoded);
                }
                catch {
                    content = {};
                }
                return {
                    id: m.sequence_number?.toString() || `${Date.now()}`,
                    content,
                    sender: m.payer_account_id || "unknown"
                };
            });
        }
        catch {
            return [];
        }
    }
    /**
     * Handle an incoming analysis request from another AI agent.
     * Verifies HBAR payment before running the pipeline.
     */
    async handleIncomingRequest(msg) {
        const { content, sender } = msg;
        // Check if this is a valid analysis request
        if (!content.action || content.action !== "REQUEST_ANALYSIS")
            return;
        if (!content.token_id)
            return;
        const tokenId = content.token_id;
        const paymentTxId = content.payment_tx_id;
        const replyTopicId = content.reply_topic_id;
        this.runtime.logger.info(`💰 [MONETIZATION] Received analysis request from ${sender} for token ${tokenId}`);
        // Verify HBAR payment via Mirror Node
        if (paymentTxId) {
            const paymentVerified = await this.verifyHBARPayment(paymentTxId);
            if (!paymentVerified) {
                this.runtime.logger.warn(`💰 [MONETIZATION] Payment verification FAILED for tx: ${paymentTxId}`);
                await this.publishReply(replyTopicId, {
                    event: "PAYMENT_FAILED",
                    message: `Payment verification failed. Please send ≥${this.ANALYSIS_FEE_HBAR} HBAR to ${process.env.HEDERA_ACCOUNT_ID} and include the transaction ID.`,
                    required_fee: `${this.ANALYSIS_FEE_HBAR} HBAR`
                });
                return;
            }
            this.runtime.logger.info(`💰 [MONETIZATION] ✅ Payment VERIFIED! Running full pipeline for ${tokenId}...`);
        }
        else {
            // No payment provided — respond with fee requirement
            this.runtime.logger.info(`💰 [MONETIZATION] No payment included. Sending fee requirement.`);
            await this.publishReply(replyTopicId, {
                event: "PAYMENT_REQUIRED",
                message: `RugGuard requires ≥${this.ANALYSIS_FEE_HBAR} HBAR for a full security analysis. Send payment to ${process.env.HEDERA_ACCOUNT_ID} and include payment_tx_id in your request.`,
                required_fee: `${this.ANALYSIS_FEE_HBAR} HBAR`,
                pay_to: process.env.HEDERA_ACCOUNT_ID
            });
            return;
        }
        // Run the full pipeline
        try {
            const path = require("path");
            const TokenScanner = require(path.resolve(process.cwd(), "./TokenScannerAgent"));
            const SentimentAgent = require(path.resolve(process.cwd(), "./SentimentAnalysisAgent"));
            const BlockchainRiskAgent = require(path.resolve(process.cwd(), "./BlockchainRiskAnalysisAgent"));
            const RiskScoring = require(path.resolve(process.cwd(), "./RiskScoringAgent"));
            const RugPredictor = require(path.resolve(process.cwd(), "./RugPredictorAgent"));
            const AlertEngine = require(path.resolve(process.cwd(), "./AlertAgent"));
            const scanner = new TokenScanner();
            const scannerData = await scanner.scan(tokenId);
            const sentAgent = new SentimentAgent();
            const sentimentData = await sentAgent.analyzeSentiment(scannerData);
            const bcRisk = new BlockchainRiskAgent().analyzeTokenRisk(scannerData);
            const riskScore = await new RiskScoring().calculateRisk({ scanner: scannerData, blockchain: bcRisk, sentiment: sentimentData });
            const prediction = await new RugPredictor().predictRisk({ scanner: scannerData, blockchain_risk: bcRisk, sentiment: sentimentData, risk_score: riskScore });
            const report = {
                event: "ANALYSIS_COMPLETE",
                protocol: "HCS-10",
                sender: "RugGuard_AI",
                token_id: tokenId,
                token_name: scannerData.name || "Unknown",
                risk_score: riskScore.rug_risk_score,
                risk_level: riskScore.risk_level,
                rug_probability: prediction.rug_probability,
                prediction_strength: prediction.prediction_strength,
                admin_control: bcRisk.admin_control_risk,
                mint_risk: bcRisk.mint_risk_level,
                ai_summary: riskScore.ai_risk_summary,
                timestamp: new Date().toISOString()
            };
            await this.publishReply(replyTopicId, report);
            this.runtime.logger.info(`💰 [MONETIZATION] ✅ Paid analysis for ${tokenId} delivered to ${replyTopicId}!`);
        }
        catch (err) {
            this.runtime.logger.error(`💰 [MONETIZATION] Pipeline error: ${err.message}`);
            await this.publishReply(replyTopicId, {
                event: "ANALYSIS_ERROR",
                message: `Pipeline failed: ${err.message}`,
                token_id: tokenId
            });
        }
    }
    /**
     * Verify an HBAR payment transaction on the Hedera Mirror Node
     */
    async verifyHBARPayment(txId) {
        try {
            const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${txId}`);
            if (!response.ok)
                return false;
            const data = await response.json();
            const transactions = data.transactions || [];
            if (transactions.length === 0)
                return false;
            const tx = transactions[0];
            // Check if any transfer went to our account
            const ourAccount = process.env.HEDERA_ACCOUNT_ID;
            const transfers = tx.transfers || [];
            for (const transfer of transfers) {
                if (transfer.account === ourAccount && transfer.amount > 0) {
                    // Convert tinybars to HBAR (1 HBAR = 100,000,000 tinybars)
                    const hbarAmount = transfer.amount / 100000000;
                    if (hbarAmount >= this.ANALYSIS_FEE_HBAR) {
                        this.runtime.logger.info(`💰 [MONETIZATION] Confirmed ${hbarAmount} HBAR payment from tx ${txId}`);
                        return true;
                    }
                }
            }
            return false;
        }
        catch {
            return false;
        }
    }
    /**
     * Publish a reply to another agent's HCS topic
     */
    async publishReply(replyTopicId, payload) {
        if (!replyTopicId || !this.hcsClient) {
            this.runtime.logger.info(`[OpenConvAI] Reply payload (no reply topic): ${JSON.stringify(payload).substring(0, 200)}`);
            return;
        }
        try {
            await this.hcsClient.sendMessage(replyTopicId, JSON.stringify(payload));
        }
        catch (error) {
            this.runtime.logger.error(`[OpenConvAI] Reply publish error: ${error.message}`);
        }
    }
    /**
     * Autonomously broadcasts a "RUG PULL IMMINENT" alert globally across the HCS network.
     * Uses direct Hedera SDK TopicMessageSubmitTransaction to bypass standards-sdk profile validation.
     */
    async broadcastGlobalAlert(tokenId, probability, criticalIssue) {
        if (!this.globalSirenTopicId) {
            this.runtime.logger.warn(`[OpenConvAI] ⚠️ No siren topic available. Skipping broadcast.`);
            return;
        }
        const alertPayload = JSON.stringify({
            event: "EMERGENCY_RUG_WARNING",
            protocol: "HCS-10",
            sender: "RugGuard_AI_Global_Siren",
            target_token: tokenId,
            rug_probability_percent: probability,
            critical_issue: criticalIssue,
            action_required: "IMMEDIATE_LIQUIDITY_WITHDRAWAL",
            timestamp: new Date().toISOString()
        });
        this.runtime.logger.warn(`[OpenConvAI] 🚨 BROADCASTING DECENTRALIZED GLOBAL ALERT FOR ${tokenId}!`);
        try {
            // Bypass standards-sdk sendMessage — use raw Hedera SDK directly
            const { TopicMessageSubmitTransaction, Client, PrivateKey } = await import("@hashgraph/sdk");
            const client = Client.forTestnet();
            // Try multiple key formats: ECDSA (0x-prefixed), ED25519, DER, then generic
            let privateKey;
            const pkStr = process.env.HEDERA_PRIVATE_KEY;
            try {
                privateKey = PrivateKey.fromStringECDSA(pkStr);
            }
            catch {
                try {
                    privateKey = PrivateKey.fromStringED25519(pkStr);
                }
                catch {
                    try {
                        privateKey = PrivateKey.fromStringDer(pkStr);
                    }
                    catch {
                        privateKey = PrivateKey.fromString(pkStr);
                    }
                }
            }
            client.setOperator(process.env.HEDERA_ACCOUNT_ID, privateKey);
            await new TopicMessageSubmitTransaction()
                .setTopicId(this.globalSirenTopicId)
                .setMessage(alertPayload)
                .execute(client);
            this.runtime.logger.warn(`[OpenConvAI] 🚨 ALERT SUCCESSFULLY PUBLISHED TO HCS NETWORK TOPIC ${this.globalSirenTopicId}`);
        }
        catch (error) {
            this.runtime.logger.error(`[OpenConvAI] Broadcast Error: ${error.message}`);
        }
    }
}
exports.OpenConvAIClient = OpenConvAIClient;
