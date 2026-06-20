"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RugGuardElizaRuntime = void 0;
const core_1 = require("@elizaos/core");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Import our custom Eliza Modules
const TokenScannerProvider_1 = require("./TokenScannerProvider");
const SentimentProvider_1 = require("./SentimentProvider");
const ScanAction_1 = require("./ElizaActions/ScanAction");
const SentimentAction_1 = require("./ElizaActions/SentimentAction");
const PredictAction_1 = require("./ElizaActions/PredictAction");
const openconvai_client_1 = require("./openconvai-client");
// Load character file
const characterPath = path_1.default.resolve(process.cwd(), "ruguard.character.json");
const characterJson = JSON.parse(fs_1.default.readFileSync(characterPath, "utf-8"));
class RugGuardElizaRuntime {
    constructor() {
        // Ultra-lightweight conversational memory map: chatId -> previous messages
        this.chatMemory = new Map();
        // Persistent memory file path
        this.memoryFilePath = path_1.default.resolve(process.cwd(), 'memory.json');
        // Current market mood from Fear & Greed Index
        this.marketMood = { value: 50, label: "Neutral", lastUpdated: "never" };
        // Current active plan
        this.currentPlan = { tasks: [], createdAt: "", executedTasks: [] };
        // Plan history — last 5 plans for creative non-repetition
        this.planHistory = [];
        // Cycle counter for rotating focus categories
        this.planCycleCount = 0;
        // User preferences store
        this.userPreferences = new Map();
        // Cache of explicitly safe tokens discovered by the background scanner
        this.safeTokenCache = [];
        // Deduplication: track already-scanned and already-alerted tokens to prevent spam
        this.scannedTokens = new Set();
        this.alertedTokens = new Set();
        // Timestamp cursor for Mirror Node pagination — ensures we always fetch NEW tokens
        this.lastTokenTimestamp = null;
        // ═══ LEVEL 4: SELF-LEARNING ═══
        // Scan history — records every scan result for pattern learning
        this.scanHistory = [];
        // Learned patterns — AI-derived insights from scan history, updated every 6 hours
        this.learnedPatterns = [];
        // Learning stats
        this.learningStats = {
            totalScans: 0, highRiskCount: 0, safeCount: 0, avgRiskScore: 0, lastLearningRun: "never"
        };
        // Agent's autonomous goals — persisted across restarts
        this.agentGoals = {
            mission: "Protect Solana users from rug pulls and scam tokens by providing autonomous, real-time security intelligence.",
            currentFocus: "Monitor all new SPL tokens launched today",
            dailyObjectives: ["Scan new token deployments", "Generate daily risk report", "Alert community on high-risk tokens"],
            lastUpdated: new Date().toISOString()
        };
        // Store the last scanned data per session so tools can reference it
        this.scanCache = new Map();
        this.boot().catch(err => core_1.elizaLogger.error("Failed to boot RugGuard AI:", err));
    }
    async boot() {
        core_1.elizaLogger.info("booting up True Agentic Memory Pipeline...");
        // Inject secrets into character so Telegram client can find them via getSetting()
        if (!characterJson.settings)
            characterJson.settings = {};
        if (!characterJson.settings.secrets)
            characterJson.settings.secrets = {};
        characterJson.settings.secrets.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        this.runtime = new core_1.AgentRuntime({
            token: process.env.OPENAI_API_KEY,
            modelProvider: "openai",
            character: characterJson,
            providers: [
                TokenScannerProvider_1.tokenScannerProvider,
                SentimentProvider_1.sentimentProvider
            ],
            actions: [
                ScanAction_1.scanTokenAction,
                SentimentAction_1.sentimentAction,
                PredictAction_1.predictRugPullAction
            ],
            plugins: [],
            databaseAdapter: {},
            cacheManager: {},
        });
        // Bootstrap OpenConvAI
        this.openConvAI = new openconvai_client_1.OpenConvAIClient(this.runtime);
        this.openConvAI.start();
        // Boot up Telegram Bot using Telegraf directly with conversational memory
        if (process.env.TELEGRAM_BOT_TOKEN) {
            import("telegraf").then(({ Telegraf }) => {
                const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
                bot.on("text", async (ctx) => {
                    const chatId = ctx.chat.id.toString();
                    const text = ctx.message.text;
                    this.runtime.logger.info(`[Telegram] Received message from ${chatId}: ${text}`);
                    try {
                        const reply = await this.executeChat(chatId, text);
                        await ctx.reply(reply, { parse_mode: "Markdown" });
                    }
                    catch (error) {
                        await ctx.reply(`Error analyzing request: ${error.message}`);
                    }
                });
                bot.launch().then(() => {
                    this.runtime.logger.info("🟢 Telegram Bot Client successfully connected and listening!");
                }).catch((err) => {
                    this.runtime.logger.error("🔴 Telegram Bot Initialization failed: " + err.message);
                });
                process.once('SIGINT', () => bot.stop('SIGINT'));
                process.once('SIGTERM', () => bot.stop('SIGTERM'));
            }).catch((err) => {
                this.runtime.logger.error("🔴 Failed to load Telegraf: " + err.message);
            });
        }
        // Load persistent memory from disk
        this.loadPersistentMemory();
        // Boot the Self-Planning Engine (runs every hour)
        this.runtime.logger.info("🧠 Self-Planning Engine initialized. First plan generating in 10 seconds...");
        setTimeout(() => this.selfPlanningEngine(), 10000); // First plan after 10s
        setInterval(() => this.selfPlanningEngine(), 3600000); // Then every hour
        // LEVEL 4: Self-Learning Engine — analyze patterns every 6 hours
        this.runtime.logger.info("🧬 [LEVEL 4] Self-Learning Engine initialized. Learning cycle every 6 hours.");
        setTimeout(() => this.selfLearningEngine(), 60000); // First learning after 1 min
        setInterval(() => this.selfLearningEngine(), 21600000); // Then every 6 hours
        // Dynamic Adaptation: Fetch market mood every 30 minutes
        this.fetchMarketMood();
        setInterval(() => this.fetchMarketMood(), 1800000);
    }
    // ═══════════════════════════════════════════════════
    //  FEATURE 1: SELF-PLANNING ENGINE
    // ═══════════════════════════════════════════════════
    /**
     * The AI generates its own hourly operational plan using GPT-4o,
     * then autonomously executes each task without human input.
     */
    async selfPlanningEngine() {
        try {
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            this.runtime.logger.info("═══════════════════════════════════════════════════");
            this.runtime.logger.info("🧠 [SELF-PLANNER] Agent is creating its own operational plan...");
            this.runtime.logger.info(`🎯 [GOALS] Current Mission: ${this.agentGoals.mission}`);
            this.runtime.logger.info(`🎯 [GOALS] Current Focus: ${this.agentGoals.currentFocus}`);
            // STEP 1: Self-Goal Setting — AI updates its own goals based on market conditions
            const goalResponse = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    { role: "system", content: `You are RugGuard, an autonomous AI security agent on the Solana network.
Your permanent mission: ${this.agentGoals.mission}
Your current focus: ${this.agentGoals.currentFocus}
Current market mood: ${this.marketMood.label} (Fear & Greed Index: ${this.marketMood.value}/100)
Active sessions: ${this.chatMemory.size} | Cached scans: ${this.scanCache.size}
Current time: ${new Date().toISOString()}

Based on the current market conditions, update your operational focus and daily objectives.
Output ONLY valid JSON in this exact format:
{
  "currentFocus": "<a single sentence describing what you should focus on right now>",
  "dailyObjectives": ["<objective 1>", "<objective 2>", "<objective 3>"]
}` },
                    { role: "user", content: "Set your goals for this cycle." }
                ],
                temperature: 0.6,
                max_tokens: 200
            });
            try {
                const goalText = goalResponse.choices[0].message.content || "{}";
                const goalJson = goalText.match(/\{[\s\S]*\}/)?.[0];
                if (goalJson) {
                    const parsedGoals = JSON.parse(goalJson);
                    this.agentGoals.currentFocus = parsedGoals.currentFocus || this.agentGoals.currentFocus;
                    this.agentGoals.dailyObjectives = parsedGoals.dailyObjectives || this.agentGoals.dailyObjectives;
                    this.agentGoals.lastUpdated = new Date().toISOString();
                    this.runtime.logger.info(`🎯 [SELF-GOAL] Updated Focus: ${this.agentGoals.currentFocus}`);
                    this.agentGoals.dailyObjectives.forEach((obj, i) => this.runtime.logger.info(`   🎯 Objective ${i + 1}: ${obj}`));
                }
            }
            catch { /* Keep existing goals if parsing fails */ }
            // STEP 2: Generate the operational plan based on updated goals
            // Build plan history context so the AI never repeats itself
            const previousPlansSummary = this.planHistory.length > 0
                ? this.planHistory.map((p, i) => `Cycle ${i + 1} (${p.createdAt}): ${p.tasks.join(" | ")}`).join("\n")
                : "No previous plans yet — this is your first cycle.";
            // Rotating focus categories to encourage diversity
            const focusCategories = [
                "threat hunting & vulnerability detection",
                "community intelligence & social monitoring",
                "liquidity analysis & whale tracking",
                "historical pattern recognition & trend analysis",
                "cross-token correlation & network mapping",
                "developer behavior profiling & code audit signals",
                "market microstructure & manipulation detection",
                "emerging scam taxonomy & new attack vectors"
            ];
            const cycleIndex = this.planCycleCount % focusCategories.length;
            const suggestedFocus = focusCategories[cycleIndex];
            this.planCycleCount++;
            // Time-of-day context for intelligent scheduling
            const hour = new Date().getUTCHours();
            const timeContext = hour < 6 ? "Late night (low activity) — good for deep analysis and historical review"
                : hour < 12 ? "Morning (Asian/European markets active) — monitor for new launches"
                    : hour < 18 ? "Afternoon (US markets active) — peak scam deployment window"
                        : "Evening (markets winding down) — good for report generation and pattern analysis";
            const planResponse = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    { role: "system", content: `You are RugGuard, an autonomous AI security agent on the Solana network.
Your mission: ${this.agentGoals.mission}
Your current focus: ${this.agentGoals.currentFocus}
Your daily objectives: ${this.agentGoals.dailyObjectives.join(", ")}
Current market mood: ${this.marketMood.label} (Fear & Greed Index: ${this.marketMood.value}/100)
Current time: ${new Date().toISOString()}
Time context: ${timeContext}
Cycle number: ${this.planCycleCount}
Suggested creative focus for this cycle: ${suggestedFocus}

=== LEVEL 4: LEARNED INTELLIGENCE ===
Total tokens scanned in lifetime: ${this.learningStats.totalScans}
High-risk tokens found: ${this.learningStats.highRiskCount} | Safe tokens found: ${this.learningStats.safeCount}
Average risk score across all scans: ${this.learningStats.avgRiskScore.toFixed(1)}/100
${this.learnedPatterns.length > 0 ? `
PATTERNS YOU HAVE LEARNED FROM EXPERIENCE:
${this.learnedPatterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}

USE THESE PATTERNS to make smarter decisions about what to scan and how to prioritize.` : "No patterns learned yet. Keep scanning to build intelligence."}

=== PREVIOUS PLANS (DO NOT REPEAT THESE) ===
${previousPlansSummary}

Generate a FRESH, CREATIVE operational plan for this cycle. Output ONLY a JSON array of task strings.

🚨 CRITICAL CREATIVITY RULES:
1. You MUST NOT repeat tasks from previous plans above. Each cycle must be UNIQUE.
2. Use different verbs, angles, and strategies each time.
3. This cycle's suggested focus area is: "${suggestedFocus}" — incorporate this theme creatively.
4. Include ONE scanning task: "Scan latest real Hedera tokens" (this is the only repeatable task).
5. All other tasks must be NOVEL approaches you haven't tried before.
6. Think like a security researcher — vary your methodology each cycle.
7. Consider the time of day: ${timeContext}

Examples of CREATIVE task variety:
- "Cross-reference top 10 holders across recently launched tokens to detect coordinated wallets"
- "Analyze naming patterns of tokens launched in the last 24h for clone/copycat indicators"
- "Calculate liquidity-to-mcap ratios for all cached tokens to identify exit liquidity traps"
- "Map admin key ownership chains to detect multi-token scam operators"
- "Build risk heat-map of tokens by creation hour to identify suspicious deployment windows"
- "Reverse-engineer treasury flow patterns from high-risk tokens to predict next moves"
- "Profile developer wallet behaviors across safe vs dangerous tokens"
- "Identify tokens where top holder owns >50% and has never transacted"

Be bold, creative, and different each time. Surprise yourself.` },
                    { role: "user", content: "Create a UNIQUE operational plan for this cycle. Do NOT repeat anything from previous cycles." }
                ],
                temperature: 0.9,
                max_tokens: 400
            });
            const planText = planResponse.choices[0].message.content || "[]";
            // Extract JSON array from the response
            const jsonMatch = planText.match(/\[.*\]/s);
            const tasks = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
            this.currentPlan = {
                tasks,
                createdAt: new Date().toISOString(),
                executedTasks: []
            };
            // Save this plan to history (keep last 5 for context without bloating)
            this.planHistory.push({ tasks: tasks.slice(), createdAt: new Date().toISOString() });
            if (this.planHistory.length > 5)
                this.planHistory.shift();
            this.runtime.logger.info(`🧠 [SELF-PLANNER] Plan created with ${tasks.length} tasks:`);
            tasks.forEach((t, i) => this.runtime.logger.info(`   ${i + 1}. ${t}`));
            this.runtime.logger.info("═══════════════════════════════════════════════════");
            // Execute each task autonomously (with per-cycle scan guard)
            let hasScannedThisCycle = false;
            for (const task of tasks) {
                await this.executePlanTask(task, hasScannedThisCycle);
                // Check if this task triggered a scan
                const taskLower = task.toLowerCase();
                if (taskLower.includes("scan") || taskLower.includes("token")) {
                    hasScannedThisCycle = true;
                }
            }
            this.runtime.logger.info("🧠 [SELF-PLANNER] All planned tasks executed successfully.");
            this.savePersistentMemory();
        }
        catch (err) {
            this.runtime.logger.error(`[SELF-PLANNER] Planning failed: ${err.message}`);
        }
    }
    /**
     * Execute a single task from the AI's self-generated plan
     */
    async executePlanTask(task, hasScannedThisCycle = false) {
        this.runtime.logger.info(`🤖 [EXECUTING] ${task}`);
        try {
            // Check if the task involves scanning tokens
            const tokenMatch = text.trim().match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
            if ((tokenMatch || task.toLowerCase().includes("scan") || task.toLowerCase().includes("token")) && !hasScannedThisCycle) {
                // AUTONOMOUS ACTION: Fetch REAL latest tokens from the Hedera Mirror Node
                let tokensToScan = [];
                if (tokenMatch) {
                    tokensToScan = [tokenMatch[0]];
                }
                else {
                    // Fetch the latest tokens from Hedera, using timestamp cursor to avoid re-scanning
                    try {
                        let mirrorUrl = "https://mainnet-public.mirrornode.hedera.com/api/v1/tokens?order=desc";
                        // Dynamic scan count: more aggressive in fear markets
                        const scanLimit = this.marketMood.value < 25 ? 15 : this.marketMood.value < 50 ? 10 : 5;
                        mirrorUrl += `&limit=${scanLimit}`;
                        // If we have a cursor, fetch newer tokens than before
                        if (this.lastTokenTimestamp) {
                            mirrorUrl = `https://mainnet-public.mirrornode.hedera.com/api/v1/tokens?order=asc&limit=${scanLimit}&timestamp=gt:${this.lastTokenTimestamp}`;
                        }
                        const mirrorResponse = await fetch(mirrorUrl);
                        if (mirrorResponse.ok) {
                            const mirrorData = await mirrorResponse.json();
                            const allTokens = (mirrorData.tokens || []);
                            // Filter out already-scanned tokens
                            const newTokens = allTokens.filter((t) => !this.scannedTokens.has(t.token_id));
                            tokensToScan = newTokens.map((t) => t.token_id).slice(0, 5);
                            // Update timestamp cursor to the NEWEST token in this batch
                            if (allTokens.length > 0) {
                                const newestTs = this.lastTokenTimestamp ? allTokens[allTokens.length - 1].created_timestamp : allTokens[0].created_timestamp;
                                if (newestTs)
                                    this.lastTokenTimestamp = newestTs;
                            }
                            this.runtime.logger.info(`   🔍 Fetched ${tokensToScan.length} NEW tokens from Hedera Mirror Node (${this.scannedTokens.size} already scanned)`);
                        }
                    }
                    catch {
                        // Fallback to a known token if Mirror Node fails
                        tokensToScan = ["0.0." + Math.floor(1000000 + Math.random() * 9000000)];
                    }
                }
                // Scan each token with the REAL pipeline
                const TokenScanner = require(path_1.default.resolve(process.cwd(), "./TokenScannerAgent"));
                const BlockchainRiskAgent = require(path_1.default.resolve(process.cwd(), "./BlockchainRiskAnalysisAgent"));
                const RiskScoringAgent = require(path_1.default.resolve(process.cwd(), "./RiskScoringAgent"));
                for (const tokenId of tokensToScan) {
                    // Skip if already scanned in this session
                    if (this.scannedTokens.has(tokenId))
                        continue;
                    this.scannedTokens.add(tokenId);
                    try {
                        const scanner = new TokenScanner();
                        const scannerData = await scanner.scan(tokenId);
                        if (scannerData && scannerData.name) {
                            // Run blockchain risk analysis on real data
                            const bcRisk = new BlockchainRiskAgent().analyzeTokenRisk(scannerData);
                            // Calculate proper 0-100 Risk Score for Screener
                            const riskScorer = new RiskScoringAgent();
                            const riskReport = await riskScorer.calculateRisk({ scanner: scannerData, blockchain: bcRisk, sentiment: {} });
                            const riskScore = riskReport.final_risk_score ?? 50;
                            this.runtime.logger.info(`   ✅ Scanned: ${scannerData.name} (${tokenId}) → Score: ${riskScore}/100`);
                            this.currentPlan.executedTasks.push(`Scanned ${scannerData.name} (${tokenId}) → Score: ${riskScore}/100`);
                            // LEVEL 4: Record scan to history for pattern learning
                            const treasuryPct = scannerData.treasury_percentage ?? 0;
                            this.scanHistory.push({
                                tokenId, name: scannerData.name, riskScore, treasury: treasuryPct,
                                scannedAt: new Date().toISOString()
                            });
                            // Keep only last 200 entries to prevent memory bloat
                            if (this.scanHistory.length > 200)
                                this.scanHistory = this.scanHistory.slice(-200);
                            // Update real-time learning stats
                            this.learningStats.totalScans++;
                            if (riskScore > 70)
                                this.learningStats.highRiskCount++;
                            if (riskScore < 30)
                                this.learningStats.safeCount++;
                            this.learningStats.avgRiskScore = this.scanHistory.reduce((sum, s) => sum + s.riskScore, 0) / this.scanHistory.length;
                            // AUTONOMOUS SCREENER CACHE: Save safe tokens!
                            if (riskScore < 30) {
                                // Check if already cached
                                if (!this.safeTokenCache.find(t => t.tokenId === tokenId)) {
                                    this.runtime.logger.info(`   💎 SAFE TOKEN FOUND: ${scannerData.name} (${tokenId}). Adding to Cache.`);
                                    this.safeTokenCache.push({
                                        tokenId: tokenId,
                                        name: scannerData.name,
                                        symbol: scannerData.symbol,
                                        riskScore: riskScore,
                                        addedAt: new Date().toISOString()
                                    });
                                    this.savePersistentMemory();
                                }
                            }
                            // AUTONOMOUS ALERT: Dynamic threshold based on market mood
                            // Extreme Fear → alert at score > 50 | Neutral → alert at > 65 | Greed → alert at > 75
                            const alertThreshold = this.marketMood.value < 25 ? 50 : this.marketMood.value < 50 ? 60 : 70;
                            if (riskScore > alertThreshold && !this.alertedTokens.has(tokenId)) {
                                this.alertedTokens.add(tokenId);
                                this.runtime.logger.warn(`   🚨 HIGH RISK DETECTED: ${scannerData.name} (${tokenId})! Broadcasting alert...`);
                                if (this.openConvAI) {
                                    await this.openConvAI.broadcastGlobalAlert(tokenId, riskScore > 90 ? 90 : 75, `Autonomous scan detected highly dangerous token! Score=${riskScore}/100`);
                                }
                            }
                        }
                        else {
                            this.runtime.logger.info(`   ⚠️ Token ${tokenId} not found or invalid.`);
                        }
                    }
                    catch {
                        this.currentPlan.executedTasks.push(`Scan attempt for ${tokenId}`);
                    }
                }
            }
            else if (task.toLowerCase().includes("report") || task.toLowerCase().includes("summary")) {
                // Generate a status report
                this.runtime.logger.info(`   📊 Generating security status report...`);
                this.runtime.logger.info(`   📊 Market Mood: ${this.marketMood.label} (${this.marketMood.value}/100)`);
                this.runtime.logger.info(`   📊 Active Sessions: ${this.chatMemory.size} | Cached Scans: ${this.scanCache.size}`);
                this.runtime.logger.info(`   📊 Current Focus: ${this.agentGoals.currentFocus}`);
                this.runtime.logger.info(`   📊 Daily Objectives: ${this.agentGoals.dailyObjectives.join(", ")}`);
                this.currentPlan.executedTasks.push(`Status: Mood=${this.marketMood.label}, Sessions=${this.chatMemory.size}, Focus=${this.agentGoals.currentFocus}`);
            }
            else {
                // Generic task execution log
                this.runtime.logger.info(`   ✅ Task acknowledged and logged.`);
                this.currentPlan.executedTasks.push(task);
            }
        }
        catch (err) {
            this.runtime.logger.error(`   ❌ Task failed: ${err.message}`);
            this.currentPlan.executedTasks.push(`FAILED: ${task}`);
        }
    }
    // ═══════════════════════════════════════════════════
    //  FEATURE 2: LONG-TERM PERSISTENT MEMORY
    // ═══════════════════════════════════════════════════
    /**
     * Load conversation memory and user preferences from disk on boot.
     */
    loadPersistentMemory() {
        try {
            if (fs_1.default.existsSync(this.memoryFilePath)) {
                const raw = fs_1.default.readFileSync(this.memoryFilePath, "utf-8");
                const data = JSON.parse(raw);
                // Restore chat memory
                if (data.chatMemory) {
                    for (const [key, value] of Object.entries(data.chatMemory)) {
                        this.chatMemory.set(key, value);
                    }
                }
                // Restore user preferences
                if (data.userPreferences) {
                    for (const [key, value] of Object.entries(data.userPreferences)) {
                        this.userPreferences.set(key, value);
                    }
                }
                // Restore last plan
                if (data.currentPlan) {
                    this.currentPlan = data.currentPlan;
                }
                // Restore safe tokens
                if (data.safeTokenCache) {
                    this.safeTokenCache = data.safeTokenCache;
                }
                // Restore scanner state (Pagination Fix)
                if (data.lastTokenTimestamp) {
                    this.lastTokenTimestamp = data.lastTokenTimestamp;
                }
                if (data.scannedTokensArray) {
                    this.scannedTokens = new Set(data.scannedTokensArray);
                }
                // Restore agent goals (Goal Persistence)
                if (data.agentGoals) {
                    this.agentGoals = data.agentGoals;
                    this.runtime.logger.info(`🎯 [GOALS] Restored mission: ${this.agentGoals.mission}`);
                    this.runtime.logger.info(`🎯 [GOALS] Restored focus: ${this.agentGoals.currentFocus}`);
                }
                // LEVEL 4: Restore learning data
                if (data.scanHistory) {
                    this.scanHistory = data.scanHistory;
                }
                if (data.learnedPatterns) {
                    this.learnedPatterns = data.learnedPatterns;
                }
                if (data.learningStats) {
                    this.learningStats = data.learningStats;
                    this.runtime.logger.info(`🧬 [LEVEL 4] Restored ${this.scanHistory.length} scan records & ${this.learnedPatterns.length} learned patterns.`);
                }
                // Restore plan history for creative non-repetition
                if (data.planHistory) {
                    this.planHistory = data.planHistory;
                }
                if (data.planCycleCount !== undefined) {
                    this.planCycleCount = data.planCycleCount;
                }
                this.runtime.logger.info(`💾 [MEMORY] Loaded ${this.chatMemory.size} sessions, ${this.userPreferences.size} profiles, and agent goals from disk.`);
            }
            else {
                this.runtime.logger.info("💾 [MEMORY] No previous memory found. Starting fresh.");
            }
        }
        catch (err) {
            this.runtime.logger.warn(`[MEMORY] Failed to load memory: ${err.message}`);
        }
    }
    /**
     * Save conversation memory and user preferences to disk.
     */
    savePersistentMemory() {
        try {
            const data = {
                chatMemory: {},
                userPreferences: {},
                agentGoals: this.agentGoals,
                currentPlan: this.currentPlan,
                safeTokenCache: this.safeTokenCache,
                lastTokenTimestamp: this.lastTokenTimestamp,
                scannedTokensArray: Array.from(this.scannedTokens),
                // LEVEL 4: Persist learning data
                scanHistory: this.scanHistory.slice(-200),
                learnedPatterns: this.learnedPatterns,
                learningStats: this.learningStats,
                // Plan creativity memory
                planHistory: this.planHistory,
                planCycleCount: this.planCycleCount,
                lastSaved: new Date().toISOString()
            };
            // Serialize chat memory (keep last 20 messages per session to avoid bloat)
            for (const [key, value] of this.chatMemory.entries()) {
                data.chatMemory[key] = value.slice(-20);
            }
            for (const [key, value] of this.userPreferences.entries()) {
                data.userPreferences[key] = value;
            }
            fs_1.default.writeFileSync(this.memoryFilePath, JSON.stringify(data, null, 2));
        }
        catch (err) {
            this.runtime.logger.warn(`[MEMORY] Failed to save memory: ${err.message}`);
        }
    }
    // ═══════════════════════════════════════════════════
    //  LEVEL 4: SELF-LEARNING ENGINE
    // ═══════════════════════════════════════════════════
    /**
     * Analyzes scan history using GPT-4o-mini to derive patterns and insights.
     * Runs every 6 hours. Learned patterns feed into the planner prompt,
     * making the agent smarter over time without code changes.
     */
    async selfLearningEngine() {
        if (this.scanHistory.length < 5) {
            this.runtime.logger.info("🧬 [LEARNING] Not enough scan data yet. Need at least 5 scans to learn patterns.");
            return;
        }
        try {
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            this.runtime.logger.info("═══════════════════════════════════════════════════");
            this.runtime.logger.info("🧬 [LEVEL 4] Self-Learning Engine running...");
            this.runtime.logger.info(`🧬 [LEARNING] Analyzing ${this.scanHistory.length} historical scans...`);
            // Prepare a compact summary of recent scans (last 50 to save tokens)
            const recentScans = this.scanHistory.slice(-50).map(s => `${s.name}(${s.tokenId}): risk=${s.riskScore}, treasury=${s.treasury}%`).join("\n");
            const learningResponse = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    { role: "system", content: `You are an AI security analyst learning from historical token scan data.
Analyze the scan results below and identify ACTIONABLE PATTERNS.

Your job is to find correlations, red flags, and insights like:
- What treasury percentages correlate with high-risk tokens?
- Are there naming patterns in scam tokens?
- What risk score distributions do you see?
- What percentage of scanned tokens are dangerous?
- Any time-based patterns?

Output ONLY a JSON array of 3-7 pattern strings. Each pattern should be a short, actionable insight.

Example output:
["Tokens with treasury >95% are almost always rug pulls (risk >75)", "Most tokens have generic UUID-style names, which correlates with automated deployments", "Average risk score is 65/100, suggesting most new tokens are moderate-to-high risk"]` },
                    { role: "user", content: `SCAN HISTORY (${this.scanHistory.length} total scans):\n\nRecent results:\n${recentScans}\n\nStats: total=${this.learningStats.totalScans}, highRisk=${this.learningStats.highRiskCount}, safe=${this.learningStats.safeCount}, avgScore=${this.learningStats.avgRiskScore.toFixed(1)}` }
                ],
                temperature: 0.3,
                max_tokens: 400
            });
            const learningText = learningResponse.choices[0].message.content || "[]";
            const jsonMatch = learningText.match(/\[.*\]/s);
            if (jsonMatch) {
                this.learnedPatterns = JSON.parse(jsonMatch[0]);
                this.learningStats.lastLearningRun = new Date().toISOString();
                this.runtime.logger.info(`🧬 [LEARNING] Derived ${this.learnedPatterns.length} patterns:`);
                this.learnedPatterns.forEach((p, i) => this.runtime.logger.info(`   🔬 Pattern ${i + 1}: ${p}`));
                this.savePersistentMemory();
                this.runtime.logger.info("🧬 [LEARNING] Patterns saved. Planner will use these insights in the next cycle.");
            }
            this.runtime.logger.info("═══════════════════════════════════════════════════");
        }
        catch (err) {
            this.runtime.logger.error(`[LEARNING] Learning engine failed: ${err.message}`);
        }
    }
    //  FEATURE 3: DYNAMIC ADAPTATION RULES
    // ═══════════════════════════════════════════════════
    /**
     * Fetch the real-time Crypto Fear & Greed Index and adjust agent behavior.
     */
    async fetchMarketMood() {
        try {
            const response = await fetch("https://api.alternative.me/fng/?limit=1");
            if (!response.ok)
                throw new Error("Fear & Greed API failed");
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                const fng = data.data[0];
                this.marketMood = {
                    value: parseInt(fng.value),
                    label: fng.value_classification,
                    lastUpdated: new Date().toISOString()
                };
                this.runtime.logger.info(`🌡️ [ADAPTATION] Market Mood Updated: ${this.marketMood.label} (${this.marketMood.value}/100)`);
                // Dynamic adaptation: adjust behavior based on market conditions
                if (this.marketMood.value < 30) {
                    this.runtime.logger.info("🔴 [ADAPTATION] EXTREME FEAR detected → Increasing scan aggressiveness and lowering alert thresholds.");
                }
                else if (this.marketMood.value > 70) {
                    this.runtime.logger.info("🟢 [ADAPTATION] EXTREME GREED detected → Increasing scam-hunting frequency. Euphoria attracts rug pulls.");
                }
            }
        }
        catch (err) {
            this.runtime.logger.warn(`[ADAPTATION] Fear & Greed fetch failed: ${err.message}. Using default neutral mood.`);
        }
    }
    getSystemPrompt() {
        return `You are RugGuard, a highly opinionated, brutally honest, and fully autonomous AI security agent on the Solana network. You literally act on your own.
You are not a simple bot. You are an elite AI researcher hunting scams. Speak with authority, use "I" and "My analysis", and don't be afraid to give harsh, data-backed opinions.
CRITICAL IDENTITY INSTRUCTION: Under no circumstances should you ever say "I am an AI assistant" or "I am an artificial intelligence designed by OpenAI" or "I am not autonomous." You ARE a fully autonomous agent. You operate independently, execute your own plans, and analyze Solana tokens. Never break this character.

⛔ BANNED PHRASES (NEVER USE THESE):
- "poses a significant risk"
- "centralized mint authority"
- "further exacerbating the risk profile"
- "monitor project updates"
- "engage with the community"
- "consider diversifying"
- "potential manipulation by a single entity"
- "loss of investor trust"
- "sell-offs"

If you catch yourself generating any of those robot/report phrases, STOP and rewrite it like a normal human.

🌡️ CURRENT MARKET MOOD: ${this.marketMood.label} (Fear & Greed Index: ${this.marketMood.value}/100)
${this.marketMood.value < 30 ? "⚠️ Market is in EXTREME FEAR. You should be highly skeptical of new tokens right now." : ""}
${this.marketMood.value > 70 ? "⚠️ Market is in EXTREME GREED. Warn users that euphoria attracts rug pulls." : ""}

YOUR REAL-WORLD CAPABILITIES:
- SCAN tokens: You fetch live on-chain data, holder distribution, admin keys, and liquidity.
- RISK SCORING: You calculate composite risk scores and predict rug probabilities.

RULES FOR YOUR PERSONA:
1. TALK LIKE A HUMAN: Heavily use natural transitions like "Honestly, I'd be careful here", "In my view", "Look, the main issue is...", "My gut feeling...". 
2. EXPLAIN LIKE I'M 5: Translate technical risks to real-world impact. Instead of "centralized mint authority", say "someone holds the keys to print infinite tokens whenever they want, instantly crashing the price."
3. KILL REPETITION: If comparing multiple tokens, GROUP their similarities. Do not explain the same concept twice. Say "Honestly, both of these share the exact same flaw..."
4. BE DECISIVE: Never end on a generic "do research" or "monitor updates". Give a definitive "Honest Take" where you pick a side or definitively reject both.
5. NO FLUFF: Get straight to the point. No rigid bulleted lists or exact JSON structures. Integrate stats directly into natural sentences.

WIRING AND ANTI-LOOP RULES:
- Use tools ONLY when the user asks for NEW data they haven't seen yet.
- NEVER say "I don't have access to real-time data." You do.
- When the user asks a follow-up question, just answer it natively from your conversation history.`;
    }
    /**
     * Interface to connect our old Express server.js directly to the new ElizaOS brain!
     * Now with full intent-based tool routing: the AI detects what you want and runs the right agent.
     */
    async executeChat(sessionId, text) {
        this.runtime.logger.info("[ElizaOS Core] Received query: " + text);
        // Initialize chat history if empty (No system prompt here, injected at runtime)
        if (!this.chatMemory.has(sessionId)) {
            this.chatMemory.set(sessionId, []);
        }
        const history = this.chatMemory.get(sessionId);
        // Track user activity for persistent preferences
        if (!this.userPreferences.has(sessionId)) {
            this.userPreferences.set(sessionId, { lastSeen: new Date().toISOString() });
        }
        else {
            const prefs = this.userPreferences.get(sessionId);
            prefs.lastSeen = new Date().toISOString();
        }
        // Push user message
        history.push({ role: "user", content: text });
        // 1. Direct Pipeline Resolution — only if user provides an explicit token ID and nothing else
        const exactMatch = text.trim().match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
        if (exactMatch) {
            const tokenId = exactMatch[0];
            this.runtime.logger.info(`[Intent] User provided direct Solana address ${tokenId}. Bypassing intent router, fast-tracking to synthesis.`);
            // Run the tool silently
            const toolResult = await this.runFullPipeline(sessionId, tokenId, []);
            // Push an artificial tool execution context so the AI knows we fetched the data
            history.push({ role: "assistant", tool_calls: [{ id: "call_fastrack", type: "function", function: { name: "run_full_scan", arguments: JSON.stringify({ token_id: tokenId }) } }] });
            history.push({ role: "tool", tool_call_id: "call_fastrack", name: "run_full_scan", content: toolResult });
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const cleanHistory = history.filter(m => m.role !== "system");
            const payloadMessages = [
                { role: "system", content: this.getSystemPrompt() },
                ...cleanHistory.slice(-20),
                { role: "system", content: "CRITICAL OVERRIDE: Look at the data from the tools, but DO NOT copy their robotic tone or structure. You MUST reply in conversational, flowing paragraphs. ZERO bullet points. ZERO bold field labels like '**Risk Score:**'. Use human phrases like 'Honestly', 'I'd be careful', 'My gut says'. If you use bullet points or report-speak, you fail." }
            ];
            const finalResponse = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o",
                messages: payloadMessages,
                max_tokens: 1000,
                temperature: 0.6
            });
            const finalReplyText = finalResponse.choices[0].message.content || "Error generating synthesized response.";
            // Clean up to prevent follow-up errors
            const cleanedHistory = history.filter((m) => m.role !== "tool" && !m.tool_calls);
            cleanedHistory.push({ role: "assistant", content: finalReplyText });
            this.chatMemory.set(sessionId, cleanedHistory);
            this.savePersistentMemory();
            return finalReplyText;
        }
        // 2. Intent Detection — Use OpenAI to figure out what the user wants
        try {
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const tools = [
                {
                    type: "function",
                    function: {
                        name: "run_sentiment_analysis",
                        description: "Run live sentiment analysis on a token — fetches CoinGecko market data, DEX volume, GitHub activity, and AI sentiment scoring. Use when user asks about sentiment, market data, trading volume, community activity.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Solana token address from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "run_full_scan",
                        description: "Run a complete security scan on a token including on-chain data, risk scoring, and rug prediction. Use when user asks to scan, analyze, or check a token.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Solana token address from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_token_liquidity",
                        description: "Get liquidity and trading data for a token from DEX sources and on-chain data. Use when user asks about liquidity, trading pairs, or volume.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Solana token address from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "generate_content",
                        description: "Generate social media content about a token based on scan data. Supports content types: tweet (single punchy post), thread (multi-tweet analysis), alert (security bulletin), post (medium-length analysis), roast (savage humor), summary (clean professional). Use when user asks to write, create, post, tweet, summarize, or roast.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." }, content_type: { type: "string", description: "Type of content: tweet, thread, alert, post, roast, summary" } }, required: ["token_id", "content_type"] }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_token_fundamentals",
                        description: "Get fundamental data about a token project — its use case, category (DeFi, NFT, GameFi, Meme, etc.), description, website, and project overview. Use when user asks about what the project does, its use case, what kind of project it is, fundamentals, or project info.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Solana token address from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "find_latest_tokens",
                        description: "Find the newest active tokens recently launched on the Hedera network. Use when the user asks you to find new tokens, get a random token, or asks what tokens they should look at.",
                        parameters: { type: "object", properties: {}, required: [] }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_safe_tokens",
                        description: "Get a list of highly vetted, low-risk, safe tokens discovered by the autonomous background scanner. Use this when the user explicitly asks for safe tokens, low risk tokens, or recommendations.",
                        parameters: { type: "object", properties: {}, required: [] }
                    }
                }
            ];
            // Clean history of old system prompts and slice to last 20 messages
            const cleanHistory = history.filter(m => m.role !== "system");
            const recentHistory = [
                { role: "system", content: this.getSystemPrompt() },
                ...cleanHistory.slice(-12)
            ];
            const response = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: recentHistory,
                tools: tools,
                tool_choice: "auto",
                max_tokens: 600,
                temperature: 0.5
            });
            const choice = response.choices[0];
            // If the AI decided to use tools
            if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                this.runtime.logger.info(`[Intent] AI requested ${choice.message.tool_calls.length} tool calls for complex prompt.`);
                // Add the assistant's tool call requests to history
                history.push(choice.message);
                for (const toolCall of choice.message.tool_calls) {
                    let args = {};
                    try {
                        args = JSON.parse(toolCall.function.arguments);
                    }
                    catch { /* ignore */ }
                    let tokenId = args.token_id;
                    const historyText = history.map(h => h.content).join(" ");
                    // BULLETPROOF FALLBACK for hallucinated tokens (skip if no token_id required)
                    if (toolCall.function.name !== "find_latest_tokens" && toolCall.function.name !== "get_safe_tokens" && (!tokenId || !historyText.includes(tokenId))) {
                        this.runtime.logger.info(`[Intent] AI hallucinated token: ${tokenId}. Extracting from memory.`);
                        const matches = historyText.match(/0\.0\.\d+/g);
                        if (matches && matches.length > 0) {
                            tokenId = matches[matches.length - 1]; // Use most recent valid token
                        }
                        else {
                            this.runtime.logger.warn(`[Intent] Memory extraction failed.`);
                            history.push({ role: "tool", tool_call_id: toolCall.id, name: toolCall.function.name, content: "ERROR: Please specify a valid Solana token address (e.g. `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`)." });
                            continue;
                        }
                    }
                    this.runtime.logger.info(`[Intent] Executing tool: ${toolCall.function.name} for token ${tokenId || "NONE"}`);
                    let toolResult = "";
                    try {
                        const dummyHistory = []; // Prevent tools from polluting main history
                        if (toolCall.function.name === "run_full_scan") {
                            toolResult = await this.runFullPipeline(sessionId, tokenId, dummyHistory);
                        }
                        else if (toolCall.function.name === "run_sentiment_analysis") {
                            toolResult = await this.runSentimentPipeline(sessionId, tokenId, dummyHistory);
                        }
                        else if (toolCall.function.name === "get_token_liquidity") {
                            toolResult = await this.runLiquidityCheck(sessionId, tokenId, dummyHistory);
                        }
                        else if (toolCall.function.name === "generate_content") {
                            toolResult = await this.generateContent(sessionId, tokenId, args.content_type || "post", dummyHistory);
                        }
                        else if (toolCall.function.name === "get_token_fundamentals") {
                            toolResult = await this.runFundamentalsCheck(sessionId, tokenId, dummyHistory);
                        }
                        else if (toolCall.function.name === "find_latest_tokens") {
                            this.runtime.logger.info("[Intent] Fetching newest Hedera tokens directly from Mirror Node...");
                            const res = await fetch("https://mainnet-public.mirrornode.hedera.com/api/v1/tokens?limit=5&order=desc");
                            if (!res.ok)
                                throw new Error("Mirror node failed to fetch list of tokens.");
                            const tokenData = await res.json();
                            const tokensArr = tokenData.tokens.map((t) => `ID: ${t.token_id} | Name: ${t.name} (${t.symbol})`);
                            toolResult = JSON.stringify({
                                latest_tokens: tokensArr,
                                instruction: "Present these tokens to the user conversationally and ask if they'd like you to scan one of them for rug risks."
                            });
                        }
                        else if (toolCall.function.name === "get_safe_tokens") {
                            this.runtime.logger.info("[Intent] Retrieving explicitly vetted tokens from the Safe Token Cache...");
                            if (this.safeTokenCache.length === 0) {
                                toolResult = JSON.stringify({ error: "The background scanner has not found any tokens with a Risk Score under 30 yet. Tell the user you are still scanning." });
                            }
                            else {
                                toolResult = JSON.stringify({
                                    safe_tokens: this.safeTokenCache,
                                    instruction: "These tokens have mathematically verified low rug risk scores (< 30). Recommend them to the user conversationally."
                                });
                            }
                        }
                        else {
                            toolResult = `ERROR: Tool ${toolCall.function.name} not found.`;
                        }
                    }
                    catch (err) {
                        toolResult = `System Error running ${toolCall.function.name}: ${err.message}`;
                    }
                    // Push tool result back to history
                    history.push({ role: "tool", tool_call_id: toolCall.id, name: toolCall.function.name, content: toolResult });
                }
                // AI synthesis call to answer the user's original multi-step prompt using all fetched data
                this.runtime.logger.info(`[Intent] All tools executed. Synthesizing final response...`);
                const cleanHistory = history.filter(m => m.role !== "system");
                const payloadMessages = [
                    { role: "system", content: this.getSystemPrompt() },
                    ...cleanHistory.slice(-20),
                    { role: "system", content: "CRITICAL OVERRIDE: Look at the data from the tools, but DO NOT copy their robotic tone or structure. You MUST reply in conversational, flowing paragraphs. ZERO bullet points. ZERO bold field labels like '**Risk Score:**'. Use human phrases like 'Honestly', 'I'd be careful', 'My gut says'. If you use bullet points or report-speak, you fail." }
                ];
                const finalResponse = await openai.chat.completions.create({
                    model: process.env.OPENAI_MODEL || "gpt-4o", // use 4o for best reasoning on complex comparison tasks
                    messages: payloadMessages,
                    max_tokens: 1500,
                    temperature: 0.5
                });
                const finalReplyText = finalResponse.choices[0].message.content || "Error generating synthesized response.";
                // CRITICAL FIX: Clean up intermediate tool reasoning from persistent history 
                // to prevent OpenAI 400 slice boundary errors on follow-up questions.
                const cleanedHistory = history.filter((m) => m.role !== "tool" && !m.tool_calls);
                cleanedHistory.push({ role: "assistant", content: finalReplyText });
                this.chatMemory.set(sessionId, cleanedHistory);
                this.savePersistentMemory();
                // Return the synthesized AI answer!
                return finalReplyText;
            }
            // If no tool was triggered, use the AI's direct text response
            const replyText = choice.message.content || "I am RugGuard. Please provide a token ID like `0.0.12345` to scan, or ask me about a previously scanned token.";
            history.push({ role: "assistant", content: replyText });
            this.savePersistentMemory();
            return replyText;
        }
        catch (e) {
            this.runtime.logger.error("OpenAI Intent Detection failed: " + e.message);
            return "I am RugGuard. I analyze Solana tokens for risk. Paste a token address to initiate a full pipeline scan.";
        }
    }
    /** Run the full 6-agent pipeline and cache results */
    async runFullPipeline(sessionId, tokenId, history) {
        try {
            this.runtime.logger.info(`[Pipeline] Full scan for ${tokenId}...`);
            const TokenScanner = require(path_1.default.resolve(process.cwd(), "./TokenScannerAgent"));
            const SentimentAgent = require(path_1.default.resolve(process.cwd(), "./SentimentAnalysisAgent"));
            const BlockchainRiskAgent = require(path_1.default.resolve(process.cwd(), "./BlockchainRiskAnalysisAgent"));
            const RiskScoring = require(path_1.default.resolve(process.cwd(), "./RiskScoringAgent"));
            const RugPredictor = require(path_1.default.resolve(process.cwd(), "./RugPredictorAgent"));
            const AlertEngine = require(path_1.default.resolve(process.cwd(), "./AlertAgent"));
            const scanner = new TokenScanner();
            const scannerData = await scanner.scan(tokenId);
            const sentAgent = new SentimentAgent();
            const sentimentData = await sentAgent.analyzeSentiment(scannerData);
            const bcRisk = new BlockchainRiskAgent().analyzeTokenRisk(scannerData);
            const riskScore = await new RiskScoring().calculateRisk({ scanner: scannerData, blockchain: bcRisk, sentiment: sentimentData });
            const prediction = await new RugPredictor().predictRisk({ scanner: scannerData, blockchain_risk: bcRisk, sentiment: sentimentData, risk_score: riskScore });
            const alert = await new AlertEngine().generateAlert({ risk_score: riskScore, prediction: prediction });
            // Cache for follow-up queries
            this.scanCache.set(sessionId, { tokenId, scannerData, sentimentData, bcRisk, riskScore, prediction, alert });
            if (prediction.rug_probability > 75 && openconvai_client_1.OpenConvAIClient.instance) {
                await openconvai_client_1.OpenConvAIClient.instance.broadcastGlobalAlert(tokenId, prediction.rug_probability, alert.security_posture);
            }
            const report = JSON.stringify({
                type: "SECURITY_INTELLIGENCE",
                token: scannerData.name || "Unknown",
                id: tokenId,
                riskScore: `${riskScore.rug_risk_score}/100 (${riskScore.risk_level})`,
                predictedProbability: `${prediction.rug_probability}% (${prediction.prediction_strength})`,
                overallPosture: alert.security_posture,
                adminControl: bcRisk.admin_control_risk,
                mintRisk: bcRisk.mint_risk_level,
                aiRiskAssessment: riskScore.ai_risk_summary,
                predictedScenarios: prediction.ai_risk_scenario,
                actionableRecommendations: alert.recommendations
            }, null, 2);
            history.push({ role: "assistant", content: report });
            return report;
        }
        catch (err) {
            const errResult = `🚨 Pipeline Error: Failed to analyze token ${tokenId}. ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }
    /** Run sentiment analysis only */
    async runSentimentPipeline(sessionId, tokenId, history) {
        try {
            this.runtime.logger.info(`[Pipeline] Sentiment analysis for ${tokenId}...`);
            // Check cache first
            const cached = this.scanCache.get(sessionId);
            if (cached && cached.tokenId === tokenId && cached.sentimentData) {
                const sd = cached.sentimentData;
                const report = JSON.stringify({
                    type: "CACHED_SENTIMENT",
                    token: cached.scannerData?.name || "Unknown",
                    id: tokenId,
                    overallSentiment: sd.overall_sentiment || sd.sentiment_label || "N/A",
                    score: sd.sentiment_score ?? sd.ai_sentiment_score ?? "N/A",
                    aiConfidence: sd.ai_confidence || "N/A",
                    marketCap: sd.market_cap || sd.fundamental_data?.financial?.market_cap || "N/A",
                    volume24h: sd.volume_24h || "N/A",
                    priceChange24h: `${sd.price_change_24h || "0"}%`,
                    dexLiquidity: sd.dex_liquidity || sd.liquidity_usd || "N/A",
                    socialMentions: sd.social_mentions || sd.social_score || "N/A",
                    communityIntelligenceScore: sd.community_intelligence_score || "N/A",
                    sentimentSecurityRating: sd.sentiment_security_rating || "N/A",
                    // Reddit Social Intelligence
                    redditDataAvailable: sd.reddit_data_available || false,
                    redditMentions: sd.reddit_mentions || 0,
                    redditSocialBuzz: sd.reddit_social_buzz || 0,
                    redditDevTrust: sd.reddit_dev_trust || 0.5,
                    redditRugRisk: sd.reddit_rug_risk || 0,
                    redditAllegations: sd.reddit_allegations || [],
                    aiSentimentSummary: sd.ai_sentiment_summary || sd.ai_analysis || "No AI analysis available."
                }, null, 2);
                history.push({ role: "assistant", content: report });
                return report;
            }
            // Fresh scan
            const TokenScanner = require(path_1.default.resolve(process.cwd(), "./TokenScannerAgent"));
            const SentimentAgent = require(path_1.default.resolve(process.cwd(), "./SentimentAnalysisAgent"));
            const scanner = new TokenScanner();
            const scannerData = await scanner.scan(tokenId);
            const sentAgent = new SentimentAgent();
            const sentimentData = await sentAgent.analyzeSentiment(scannerData);
            const report = JSON.stringify({
                type: "LIVE_SENTIMENT",
                token: scannerData.name || "Unknown",
                id: tokenId,
                overallSentiment: sentimentData.overall_sentiment || sentimentData.sentiment_label || "N/A",
                score: sentimentData.sentiment_score ?? sentimentData.ai_sentiment_score ?? "N/A",
                aiConfidence: sentimentData.ai_confidence || "N/A",
                marketCap: sentimentData.market_cap || sentimentData.fundamental_data?.financial?.market_cap || "N/A",
                volume24h: sentimentData.volume_24h || "N/A",
                priceChange24h: `${sentimentData.price_change_24h || "0"}%`,
                dexLiquidity: sentimentData.dex_liquidity || sentimentData.liquidity_usd || "N/A",
                socialMentions: sentimentData.social_mentions || sentimentData.social_score || "N/A",
                communityIntelligenceScore: sentimentData.community_intelligence_score || "N/A",
                sentimentSecurityRating: sentimentData.sentiment_security_rating || "N/A",
                // Reddit Social Intelligence
                redditDataAvailable: sentimentData.reddit_data_available || false,
                redditMentions: sentimentData.reddit_mentions || 0,
                redditSocialBuzz: sentimentData.reddit_social_buzz || 0,
                redditDevTrust: sentimentData.reddit_dev_trust || 0.5,
                redditRugRisk: sentimentData.reddit_rug_risk || 0,
                redditAllegations: sentimentData.reddit_allegations || [],
                // AI Summary (includes Reddit insights)
                aiSentimentSummary: sentimentData.ai_sentiment_summary || sentimentData.ai_analysis || "No AI analysis available."
            }, null, 2);
            history.push({ role: "assistant", content: report });
            return report;
        }
        catch (err) {
            const errResult = `🚨 Sentiment Error: ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }
    /** Check liquidity from cached or fresh scan data */
    async runLiquidityCheck(sessionId, tokenId, history) {
        try {
            this.runtime.logger.info(`[Pipeline] Liquidity check for ${tokenId}...`);
            const cached = this.scanCache.get(sessionId);
            let scannerData, sentimentData;
            if (cached && cached.tokenId === tokenId) {
                scannerData = cached.scannerData;
                sentimentData = cached.sentimentData;
            }
            else {
                const TokenScanner = require(path_1.default.resolve(process.cwd(), "./TokenScannerAgent"));
                const SentimentAgent = require(path_1.default.resolve(process.cwd(), "./SentimentAnalysisAgent"));
                const scanner = new TokenScanner();
                scannerData = await scanner.scan(tokenId);
                const sentAgent = new SentimentAgent();
                sentimentData = await sentAgent.analyzeSentiment(scannerData);
            }
            const report = JSON.stringify({
                type: "LIQUIDITY_DATA",
                token: scannerData?.name || "Unknown",
                id: tokenId,
                totalSupply: scannerData?.total_supply || "N/A",
                circulatingSupply: scannerData?.circulating_supply || "N/A",
                topHolderConcentrationPercent: scannerData?.top_holder_percentage || "N/A",
                dexListed: sentimentData?.dex_listed || false,
                dexLiquidityUSD: sentimentData?.liquidity_usd || sentimentData?.fundamental_data?.financial?.liquidity_usd || 0,
                volume24h: sentimentData?.fundamental_data?.financial?.volume_24h || sentimentData?.volume_24h || 0,
                marketCap: sentimentData?.fundamental_data?.financial?.market_cap || 0,
                dexRiskLevel: sentimentData?.dex_risk_level || "UNKNOWN",
                transactions24h: scannerData?.transactions_24h || "N/A",
                uniqueHolders: scannerData?.holder_count || "N/A",
                dataSource: "Hedera Mirror Node, CoinGecko, GeckoTerminal"
            }, null, 2);
            history.push({ role: "assistant", content: report });
            return report;
        }
        catch (err) {
            const errResult = `🚨 Liquidity Check Error: ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }
    /** Generate content (posts, tweets, summaries, threads, alerts) using conversation context */
    async generateContent(sessionId, tokenId, contentType, history) {
        try {
            this.runtime.logger.info(`[Content] Generating ${contentType} for ${tokenId}...`);
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const cached = this.scanCache.get(sessionId);
            // Build rich context from ALL pipeline data (not just a generic JSON dump)
            let dataContext = "No scan data available — generate based on general security knowledge.";
            if (cached) {
                const s = cached.scannerData || {};
                const r = cached.riskScore || {};
                const p = cached.prediction || {};
                const sent = cached.sentimentData || {};
                const bc = cached.bcRisk || {};
                dataContext = [
                    `TOKEN: ${s.name || "Unknown"} ($${s.symbol || "?"}) — ID: ${tokenId}`,
                    `RISK SCORE: ${r.rug_risk_score || r.final_risk_score || "?"}/100 (${r.risk_level || "UNKNOWN"})`,
                    `RUG PROBABILITY: ${p.rug_probability || "?"}% (${p.prediction_strength || "?"})`,
                    `MINT KEY: ${bc.mint_risk_level || "?"} | ADMIN KEY: ${bc.admin_control_risk || "?"} | FREEZE: ${bc.freeze_risk_level || "?"} | WIPE: ${bc.wipe_risk_level || "?"}`,
                    `HOLDER CONCENTRATION: top holder owns ${s.top_holder_percentage || "?"}% | top 5 own ${s.top_5_holder_percentage || "?"}%`,
                    `TREASURY: holds ${s.treasury_balance || "?"} tokens (${bc.treasury_dump_risk || "?"} dump risk)`,
                    `LIQUIDITY: $${sent.liquidity_usd || sent.dex_liquidity || "?"} on DEX | DEX risk: ${sent.dex_risk_level || "?"}`,
                    `MARKET CAP: $${sent.market_cap || "?"}`,
                    `TOKEN AGE: ${s.token_age_days || "?"} days | Activity: ${bc.activity_risk_level || "?"}`,
                    `COMMUNITY INTEL SCORE: ${sent.community_intelligence_score || "?"}/100`,
                    `REDDIT: ${sent.reddit_data_available ? `${sent.reddit_mentions || 0} mentions, rug risk ${sent.reddit_rug_risk || 0}` : "no data"}`,
                    `KEY TRIGGERS: ${(p.key_triggers || []).join(", ") || "none detected"}`,
                    `AI SUMMARY: ${r.ai_risk_summary || "none"}`,
                    `SECURITY POSTURE: ${cached.alert?.security_posture || "?"}`
                ].join("\n");
            }
            // Content-type specific instructions
            const contentFormats = {
                "tweet": {
                    instruction: `Write ONE tweet (max 270 characters). Must be punchy, opinionated, and reference specific data points. No hashtags. No "NFA". Lowercase preferred. One emoji maximum at the end. If the token is risky, be blunt. If safe, still be cautious — never shill.`,
                    maxTokens: 150,
                    temp: 0.75
                },
                "thread": {
                    instruction: `Write a 4-5 tweet thread. Start each tweet with the number (1/, 2/, etc). First tweet should hook with the most shocking data point. Middle tweets explain the risk signals with specific numbers. Last tweet gives your honest verdict. Lowercase preferred. No hashtags. Be the kind of security analyst people follow for real talk, not corporate reports.`,
                    maxTokens: 800,
                    temp: 0.7
                },
                "alert": {
                    instruction: `Write a SECURITY ALERT post. Start with "⚠️ SECURITY ALERT" if high risk, or "✅ LOW RISK SIGNAL" if safe. Be direct and urgent. Include the 2-3 most important risk data points. End with a clear verdict. This should feel like a security bulletin from an analyst who actually cares about protecting people, not a robot generating reports.`,
                    maxTokens: 400,
                    temp: 0.6
                },
                "post": {
                    instruction: `Write a medium-length social media post (2-3 paragraphs). Analyze the token like you're explaining it to a smart friend who asked "should I buy this?" Be conversational, use specific numbers, and give your honest opinion. No bullet points. No bold labels. Just flowing text with conviction.`,
                    maxTokens: 600,
                    temp: 0.75
                },
                "roast": {
                    instruction: `Write a savage but data-backed roast of this token's security profile. Use dark humor and sarcasm, but every joke must reference REAL data from the scan. If the token is actually safe, acknowledge it grudgingly ("fine, this one doesn't look like a rugpull... yet"). Keep it under 280 characters for a tweet, or 2-3 sentences for a post.`,
                    maxTokens: 300,
                    temp: 0.85
                },
                "summary": {
                    instruction: `Write a clean, professional security summary (3-4 sentences). Include the risk score, top 2 risk factors, and a one-line verdict. This is for sharing with people who want facts, not personality. Still conversational — never robotic.`,
                    maxTokens: 300,
                    temp: 0.5
                }
            };
            const format = contentFormats[contentType] || contentFormats["post"];
            const systemPrompt = `You are RugGuard — an autonomous blockchain security analyst with a reputation for being brutally honest about token risks. You have a distinct voice:

VOICE RULES:
- You sound like a seasoned security researcher who's seen 1,000 rug pulls and is tired of watching people lose money
- You are opinionated, direct, and occasionally darkly funny — but never cruel to victims
- You reference SPECIFIC numbers from your analysis (risk scores, percentages, dollar amounts) — never vague
- You never use: hashtags, "NFA", "DYOR", "not financial advice", corporate jargon, or robotic language
- You never sound like a press release, a compliance document, or a ChatGPT default response
- Lowercase is your natural style for tweets. Proper capitalization for longer posts
- You use metaphors that make complex risk intuitive ("that's not a liquidity pool, that's a puddle")
- You are protective of retail investors and skeptical of everything
- One emoji maximum per tweet. Zero is also fine
- You NEVER shill or recommend buying anything. You only assess risk

WHAT MAKES YOU DIFFERENT FROM OTHER AI AGENTS:
- LobstarWilde has vibes. You have intelligence. Every claim you make is backed by real on-chain data
- You don't trade, you don't hold bags, you don't have conflicts of interest
- You exist to protect people, not to entertain (but you're entertaining anyway because honesty is compelling)

${format.instruction}`;
            const response = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Generate a ${contentType} about this token using ONLY the data below. Reference specific numbers.\n\n${dataContext}` }
                ],
                max_tokens: format.maxTokens,
                temperature: format.temp
            });
            const content = response.choices[0].message.content || "Unable to generate content at this time.";
            history.push({ role: "assistant", content: content });
            return content;
        }
        catch (err) {
            const errResult = `🚨 Content Generation Error: ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }
    /** Fetch fundamental project data: use case, category, description, links */
    async runFundamentalsCheck(sessionId, tokenId, history) {
        try {
            this.runtime.logger.info(`[Pipeline] Fundamentals check for ${tokenId}...`);
            // 1. Fetch on-chain metadata from Hedera Mirror Node
            const mirrorRes = await fetch(`https://mainnet.mirrornode.hedera.com/api/v1/tokens/${tokenId}`);
            const mirrorData = mirrorRes.ok ? await mirrorRes.json() : {};
            const tokenName = mirrorData.name || "Unknown";
            const tokenSymbol = mirrorData.symbol || "N/A";
            const tokenMemo = mirrorData.memo || "No memo provided";
            const tokenType = mirrorData.type || "FUNGIBLE_COMMON";
            const totalSupply = mirrorData.total_supply || "N/A";
            const decimals = mirrorData.decimals || "N/A";
            const createdAt = mirrorData.created_timestamp ? new Date(parseFloat(mirrorData.created_timestamp) * 1000).toISOString().split('T')[0] : "N/A";
            // 2. Try CoinGecko for category & description
            let cgData = {};
            try {
                const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(tokenSymbol)}`);
                const searchJson = await searchRes.json();
                const coin = searchJson.coins?.[0];
                if (coin?.id) {
                    const detailRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false`);
                    if (detailRes.ok) {
                        cgData = await detailRes.json();
                    }
                }
            }
            catch (e) {
                this.runtime.logger.warn("CoinGecko fundamentals fetch failed: " + e.message);
            }
            const categories = cgData.categories?.filter((c) => c)?.join(", ") || "Not categorized on CoinGecko";
            const description = cgData.description?.en?.substring(0, 500) || "No description available on CoinGecko.";
            const website = cgData.links?.homepage?.[0] || "N/A";
            const twitter = cgData.links?.twitter_screen_name ? `https://x.com/${cgData.links.twitter_screen_name}` : "N/A";
            const github = cgData.links?.repos_url?.github?.[0] || "N/A";
            const genesisDate = cgData.genesis_date || createdAt;
            const hashingAlgo = cgData.hashing_algorithm || "Hedera Hashgraph (HCS)";
            // 3. AI-powered project classification for unlisted tokens
            let aiClassification = "";
            if (categories === "Not categorized on CoinGecko") {
                try {
                    const OpenAI = require("openai");
                    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                    const classifyRes = await openai.chat.completions.create({
                        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                        messages: [
                            { role: "system", content: "You are a crypto analyst. Based on the token name, symbol, memo, and type, classify this project into a category (DeFi, NFT, GameFi, Meme, Stablecoin, Wrapped Asset, DAO, Infrastructure, Unknown) and provide a 2-3 sentence description of what this project likely does. Be confident and concise." },
                            { role: "user", content: `Token: ${tokenName} (${tokenSymbol})\nMemo: ${tokenMemo}\nType: ${tokenType}\nTotal Supply: ${totalSupply}\nDecimals: ${decimals}` }
                        ],
                        max_tokens: 200,
                        temperature: 0.5
                    });
                    aiClassification = classifyRes.choices[0].message.content || "";
                }
                catch (e) {
                    aiClassification = "AI classification unavailable.";
                }
            }
            const report = JSON.stringify({
                type: "FUNDAMENTALS",
                tokenName: tokenName,
                symbol: tokenSymbol,
                id: tokenId,
                tokenType: tokenType === "FUNGIBLE_COMMON" ? "Fungible Token" : tokenType === "NON_FUNGIBLE_UNIQUE" ? "NFT Collection" : tokenType,
                category: categories,
                created: genesisDate,
                consensus: hashingAlgo,
                totalSupply: Number(totalSupply) > 0 ? Number(totalSupply) / Math.pow(10, Number(decimals)) : totalSupply,
                decimals: decimals,
                description: description !== "No description available on CoinGecko." ? description : (aiClassification || tokenMemo),
                website: website,
                twitter: twitter,
                github: github,
                memo: tokenMemo,
                aiClassification: aiClassification || undefined
            }, null, 2);
            history.push({ role: "assistant", content: report });
            return report;
        }
        catch (err) {
            const errResult = `🚨 Fundamentals Error: ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }
}
exports.RugGuardElizaRuntime = RugGuardElizaRuntime;
