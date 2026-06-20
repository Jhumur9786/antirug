AntiRug v3: The 10/10 Solana Threat Intelligence Platform
Core Philosophy: Most scanners ask "Is the token dangerous?" — AntiRug asks "Who created it? Who owns it? Who controls liquidity? Who is secretly connected? Who is selling? Who funded them? Does it behave like previous rugs?" The token itself is often not the scam. The people behind it are.

IMPORTANT

This is the final production implementation plan — single source of truth. Incorporates all prior roadmaps, v2/v3 architecture specs, and the 6 critical upgrades that push this from 9.7 to a true 10/10. No code will be written until approved.

Research basis: SolRugDetector (arXiv), Solana Authority Docs, SolFoundry Guide

Risk Rating Output
Score	Rating	Action
0–20	SAFE	Green light
21–40	LOW RISK	Proceed with caution
41–60	CAUTION	Investigate further
61–80	HIGH RISK	Avoid entry
81–100	EXTREME RISK	Do not touch
Architecture Overview
Mermaid diagram
Final Weight System
NOTE

Weights optimized for Solana reality: wallet behavior and funding relationships are dramatically more predictive than social metrics. Social and historical similarity are intentionally minimized — they provide supplementary evidence, not primary signals.


Token Security          8%
Liquidity Intelligence 15%
Holder Intelligence     8%
Wallet Intelligence    22%   ← Flagship
Deployer Intelligence  15%   ← Competitive Moat
Launch Intelligence    10%
Funding Intelligence    8%   ← Upgraded (catches wallet rotation)
Market Manipulation     5%
Social Intelligence     2%   ← Reduced (low predictive value on Solana)
Historical Similarity   2%   ← Evidence only, not risk driver
Entity Intelligence     5%   ← NEW (tracks actors, not wallets)
─────────────────────────
Total                 100%
S
c
o
r
e
r
a
w
=
∑
i
=
1
11
S
c
o
r
e
l
a
y
e
r
i
×
W
e
i
g
h
t
l
a
y
e
r
i
Score 
raw
​
 = 
i=1
∑
11
​
 Score 
layer 
i
​
 
​
 ×Weight 
layer 
i
​
 
​
 
Layer-by-Layer Specification
Layer 1 — Token Security (8%)
File: 
AuthorityRiskEngine.js
 [MODIFY]

Check	Risk Level	Score if Active	Score if Renounced
Mint Authority	Critical	90	5
Freeze Authority	High	90	5
Update Authority	High	80	5
Metadata Mutable	Medium	60	5
Token2022 Transfer Hook	High	85	0
Token2022 Permanent Delegate	High	85	0
Multi-sig modifier: If authority is active but assigned to a multisig/governance program → reduce score by 30%.

Sub-weights within layer: Mint 40%, Freeze 25%, Update 15%, Metadata 10%, Token2022 10%.

Critical Overrides:

python

if mint_authority_active:
    risk_floor = 85
if freeze_authority_active:
    risk_floor = 80
Layer 2 — Liquidity Intelligence (15%)
Files: 
LPLockAnalyzer.js
 [MODIFY] + 
LiquidityShockAgent.js
 [MODIFY]

2a. LP Lock/Burn Status
LP Status	Risk Score
LP Burned	5
Locked > 365 days	15
Locked 90–365 days	40
Locked < 90 days	70
Unlocked	95
Supported lock protocols: Raydium Lock, UNCX, Team Finance.

2b. LP Ownership
Check what % of LP tokens are owned by deployer or insider cluster.

2c. Liquidity Stability (Shock Detection)
Track liquidity changes over: 1h, 6h, 24h, 7d

2d. Exit Slippage Simulation
Simulate sells at: 
100
,
100,1,000, 
5
,
000
,
5,000,10,000, $50,000

Using constant product formula:

Δ
P
%
=
1
−
k
(
x
−
Δ
x
)
(
y
+
Δ
y
)
ΔP%=1− 
(x−Δx)(y+Δy)
k
​
 
If selling $5k causes ≥40% price impact → high liquidity shock score.

2e. Dry-Run Sell Simulation ← NEW (Critical Upgrade)
WARNING

This is the single biggest missing feature in the previous plan. Exit slippage alone is not enough.

Actually simulate a buy → sell cycle against live AMM pools to detect:

Transfer restrictions (honeypot tokens)
Hidden taxes (sell tax > 10%)
Failing swaps (reverted transactions)
Blacklist mechanisms (wallet blocked after buy)
Token2022 transfer hooks that block sells
Implementation: Use Jupiter swap simulation API or direct pool instruction simulation.

Critical Override:

python

if dry_run_sell_failed:
    risk = 100  # Confirmed honeypot
if lp_unlocked and liquidity < 100000:
    risk_floor = 90
Layer 3 — Holder Intelligence (8%)
File: 
BlockchainRiskAnalysisAgent.js
 [MODIFY]

Metrics
Top 1 holder %
Top 5 holder %
Top 10 holder % (healthy < 20%, risky > 30%)
Top 20 holder %
Gini Coefficient
G
=
∑
i
=
1
n
∑
j
=
1
n
∣
x
i
−
x
j
∣
2
n
2
x
ˉ
G= 
2n 
2
  
x
ˉ
 
∑ 
i=1
n
​
 ∑ 
j=1
n
​
 ∣x 
i
​
 −x 
j
​
 ∣
​
 
G
≥
0.85
G≥0.85 → extreme concentration → high risk
Excludes known CEXs, AMM pools, burn addresses
Holder Growth & Retention
24h / 7d / 30d holder count slopes
Are holders growing organically or leaving?
Rising volume + stagnant holders = wash trading signal
Layer 4 — Wallet Intelligence (22%) ← FLAGSHIP FEATURE
Files: 
WalletRelationshipGraph.js
 [MODIFY] + 
SmartMoneyTracker.js
 [MODIFY]

4a. Wallet Relationship Graph
Build a connectivity graph 
G
=
(
W
,
E
)
G=(W,E) of all top holders and early buyers:

text

Creator
 ├── Wallet A (funded by Creator)
 ├── Wallet B (funded by same source as A)
 └── Wallet C (circular transfers with B)
Detect:

Shared funding wallets / common ancestors
Shared exchange withdrawal patterns
Shared bundle participation (same Jito tip payer)
Circular transfers (A→B→C→A)
Insider clusters
Algorithm: Disjoint-Set Forest (Union-Find) clustering.

Cluster Supply Ratio:

C
S
R
(
C
k
)
=
∑
w
∈
C
k
B
a
l
a
n
c
e
(
w
)
T
o
t
a
l
S
u
p
p
l
y
CSR(C 
k
​
 )= 
TotalSupply
∑ 
w∈C 
k
​
 
​
 Balance(w)
​
 
Critical Override:

python

if creator_cluster_supply > 40:
    risk_floor = 95
4b. Smart Money Tracking
Cross-reference holders against 
smart_wallets.json
.

Smart money entering → risk -15
Smart money exiting → risk +20
Base score = 50 (neutral), clamped 5–95
4c. Cross-Token Relationship Engine ← NEW (Critical Upgrade)
IMPORTANT

Don't just analyze the token — analyze the ecosystem around it.

Questions this answers:

Do top holders of this token also appear as holders of previous rugged tokens?
Do the same sniper wallets appear repeatedly across different launches?
Do the same insider clusters launch together across multiple tokens?
Implementation:

For each top holder, query the deployer DB and entity DB for prior rug participation
Flag tokens where ≥3 holders were also present in ≥2 previously rugged tokens
Compute Cross-Token Contamination Score:
C
T
C
S
=
H
o
l
d
e
r
s
I
n
P
r
e
v
i
o
u
s
R
u
g
s
T
o
p
20
H
o
l
d
e
r
s
×
100
CTCS= 
Top20Holders
HoldersInPreviousRugs
​
 ×100
If 
C
T
C
S
>
30
%
CTCS>30% → elevated risk. If 
C
T
C
S
>
50
%
CTCS>50% → critical flag.

Layer 5 — Launch Intelligence (10%)
Files: 
BundlerDetector.js
 [MODIFY] + 
SniperDominanceScorer.js
 [MODIFY]

5a. Bundler Detection
Same-slot buys (Jito bundles)
Same funding source for first buyers
Shared tip payer address
Bundled Supply %	Risk Score
> 50%	90
> 30%	70
> 15%	50
< 15%	15
5b. Sniper Dominance
Supply acquired in Block 1 / Block 5 / Block 20.

Sniper Supply %	Risk Score
> 40%	85
> 25%	65
> 10%	40
< 10%	15
Critical Override:

python

if bundled_supply > 60:
    risk_floor = 90
Layer 6 — Deployer Intelligence (15%) ← COMPETITIVE MOAT
Files: 
InsiderWalletScorer.js
 [MODIFY] + 
DeployerReputationDatabase.js
 [MODIFY]

6a. Creator Balance Tracking
Condition	Risk Score
Creator holding (sold < 10%)	10
Partially sold (10–80%)	50
Mostly sold (80–99%)	80
Fully exited (100%)	95
6b. Deployer Reputation Database (SQLite)
sql

CREATE TABLE IF NOT EXISTS deployers (
    creator_address      TEXT PRIMARY KEY,
    first_seen           INTEGER NOT NULL,
    last_seen            INTEGER NOT NULL,       -- NEW: for time decay
    total_launches       INTEGER DEFAULT 1,
    rugged_launches      INTEGER DEFAULT 0,
    clean_launches       INTEGER DEFAULT 0,
    avg_pool_lifespan_sec INTEGER DEFAULT 0,
    max_ath_mcap         REAL DEFAULT 0.0,
    reputation_score     INTEGER DEFAULT 50
);
6c. Reputation Formula with Time Decay ← NEW (Critical Upgrade)
NOTE

A deployer who rugged 2 years ago but now launches legitimate projects should not be permanently flagged at maximum risk. Conversely, recent rugs should carry massive weight.

Base Reputation:

R
e
p
b
a
s
e
=
100
×
(
1
−
R
u
g
L
a
u
n
c
h
e
s
T
o
t
a
l
L
a
u
n
c
h
e
s
)
×
(
1
−
e
−
T
o
t
a
l
L
a
u
n
c
h
e
s
5
)
Rep 
base
​
 =100×(1− 
TotalLaunches
RugLaunches
​
 )×(1−e 
− 
5
TotalLaunches
​
 
 )
Time Decay Modifier:

Each historical launch is weighted by recency:

w
l
a
u
n
c
h
=
e
−
λ
⋅
Δ
t
w 
launch
​
 =e 
−λ⋅Δt
 
Where:

Δ
t
Δt = days since that launch
λ
=
0.003
λ=0.003 (half-life ≈ 231 days)
Decayed Reputation:

R
e
p
=
100
×
(
1
−
∑
r
u
g
s
w
i
∑
a
l
l
w
i
)
×
(
1
−
e
−
T
o
t
a
l
L
a
u
n
c
h
e
s
5
)
Rep=100×(1− 
∑ 
all
​
 w 
i
​
 
∑ 
rugs
​
 w 
i
​
 
​
 )×(1−e 
− 
5
TotalLaunches
​
 
 )
This means:

Rug from last week → weight ≈ 0.98 (almost full penalty)
Rug from 6 months ago → weight ≈ 0.41 (reduced penalty)
Rug from 2 years ago → weight ≈ 0.11 (minor penalty)
Key output: "This deployer launched 12 previous tokens. 9 reached near-zero liquidity within 14 days."

Critical Overrides:

python

if creator_fully_exited:
    risk_floor = 95
if creator_rug_rate > 70:
    risk_floor = 95
Layer 7 — Funding Intelligence (8%) ← Upgraded Weight
File: [NEW] 
FundingIntelligenceTracker.js

Track origin of SOL that funded the creator wallet. This catches wallet rotation scams where a serial rugger creates fresh wallets but funds them from the same source.

Funding Source	Risk Level
Binance/Coinbase/Kraken/OKX	Low (10)
Established wallet (>90d, diversified)	Low (15)
Fresh wallet (< 7 days old)	High (75)
Mixer / Tornado-like	Critical (90)
Known rug wallet	Critical (95)
Questions answered:

Who funded the creator?
Where did launch capital originate?
Does the funding wallet link to previous rugs?
Layer 8 — Market Manipulation (5%)
File: 
VolumeManipulationDetector.js
 [MODIFY]

Wash Trading Ratio (WTR)
W
T
R
=
V
o
l
u
m
e
24
h
U
n
i
q
u
e
S
i
g
n
e
r
s
24
h
×
A
v
g
O
r
d
e
r
S
i
z
e
WTR= 
UniqueSigners 
24h
​
 ×AvgOrderSize
Volume 
24h
​
 
​
 
Duplication Coefficient
D
C
=
T
r
a
n
s
a
c
t
i
o
n
s
24
h
U
n
i
q
u
e
S
i
g
n
e
r
s
24
h
DC= 
UniqueSigners 
24h
​
 
Transactions 
24h
​
 
​
 
If 
D
C
>
150
DC>150 and
⚠️ Failed to render LaTeX: KaTeX parse error: Unexpected character: '\' at position 16: Volume_{24h} > \̲
Volume_{24h} > \50,000$ → score = 90.

Self-Trading Detection
Detect A→B→A circular patterns within matching blocks.

Bot Dominance Index
Repetitive transaction intervals, HFT signatures, >85% volume from bots.

Layer 9 — Social Intelligence (2%) ← Reduced Weight
File: 
SentimentAnalysisAgent.js
 [MODIFY]

Keep minimal. Social metrics are the least predictive signal on Solana.

Signal	Check
X (Twitter) age	Account created < 30 days = risky
Engagement quality	Bot ratio analysis
Website age	Domain < 30 days = risky
Domain reputation	SSL config, WHOIS privacy
GitHub activity	Is it a fork of a template or real code?
Layer 10 — Historical Similarity Engine (2%) ← Evidence Only
File: [NEW] 
HistoricalSimilarityEngine.js

IMPORTANT

This is the AI-assisted layer. It does NOT set the risk score. It provides supporting evidence only — preventing AI hallucinations from affecting final risk.

Build a dataset of known rugged and clean tokens. Extract feature vectors. Use nearest-neighbor similarity.

Output:

text

87% similar to previously rugged tokens
Layer 11 — Entity Intelligence (5%) ← NEW LAYER
File: [NEW] 
EntityIntelligenceEngine.js

CAUTION

This is the upgrade that takes AntiRug from wallet tracking to actor tracking. Scammers rotate wallets constantly. Tracking individual wallets is insufficient. AntiRug must track entities — groups of wallets operated by the same actor.

Problem
text

Scammer uses:
  Wallet A → Token 1 (rugged)
  Wallet B → Token 2 (rugged)
  Wallet C → Token 3 (current scan)
All funded from: Master Wallet X
Traditional scanners see Wallet C as brand new with zero history. AntiRug sees it as the same entity that rugged Token 1 and Token 2.

Entity Resolution Algorithm
Funding ancestry: Wallets funded by the same ancestor within a tight window (< 24h) = same entity
Shared exchange deposits: Wallets depositing to the same exchange address = likely same entity
Temporal clustering: Wallets created/funded in rapid succession (< 1h) = suspicious coordination
Cross-token overlap: Wallets appearing as insiders across multiple token launches = organized group
Entity Database Schema (SQLite)
sql

CREATE TABLE IF NOT EXISTS entities (
    entity_id       TEXT PRIMARY KEY,
    master_wallet   TEXT,
    wallet_count    INTEGER DEFAULT 1,
    total_launches  INTEGER DEFAULT 0,
    rugged_launches INTEGER DEFAULT 0,
    first_seen      INTEGER NOT NULL,
    last_seen       INTEGER NOT NULL,
    entity_risk     INTEGER DEFAULT 50
);
CREATE TABLE IF NOT EXISTS entity_wallets (
    wallet_address  TEXT PRIMARY KEY,
    entity_id       TEXT NOT NULL,
    role            TEXT DEFAULT 'member',  -- 'master', 'deployer', 'insider', 'member'
    first_seen      INTEGER NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES entities(entity_id)
);
Entity Risk Score
E
n
t
i
t
y
R
i
s
k
=
100
×
E
n
t
i
t
y
R
u
g
L
a
u
n
c
h
e
s
d
e
c
a
y
e
d
E
n
t
i
t
y
T
o
t
a
l
L
a
u
n
c
h
e
s
d
e
c
a
y
e
d
EntityRisk=100× 
EntityTotalLaunches 
decayed
​
 
EntityRugLaunches 
decayed
​
 
​
 
Critical Override:

python

if entity_rug_rate > 70:
    risk_floor = 95
Critical Override Engine (11 Rules)
File: 
CriticalOverrideEngine.js
 [MODIFY]

Runs after all weighted scoring. Applies hard floors that cannot be overridden by low scores in other layers.

python

# Tier 1: Absolute kill switches (floor = 95–100)
if dry_run_sell_failed:
    risk = 100                              # Confirmed honeypot
if creator_exited:
    risk = max(risk, 95)
if creator_cluster_supply > 40:
    risk = max(risk, 95)
if creator_rug_rate > 70:
    risk = max(risk, 95)
if entity_rug_rate > 70:                    # NEW: Entity-level override
    risk = max(risk, 95)
if active_mint_authority and supply_growth_detected:
    risk = max(risk, 95)
# Tier 2: Severe red flags (floor = 85–90)
if lp_unlocked and liquidity < 100000:
    risk = max(risk, 90)
if bundled_supply > 60:
    risk = max(risk, 90)
if mint_authority_active:
    risk = max(risk, 85)
# Tier 3: High concern (floor = 80)
if freeze_authority_active:
    risk = max(risk, 80)
if cross_token_contamination > 50:          # NEW: Cross-token override
    risk = max(risk, 80)
Risk Trend Engine ← NEW (Critical Upgrade)
File: [NEW] 
RiskTrendEngine.js

IMPORTANT

A token's risk trajectory often matters more than the score itself. A token moving from 35 → 78 in 24 hours is far more dangerous than one sitting steady at 60.

Implementation
Store historical scan results per token in SQLite:

sql

CREATE TABLE IF NOT EXISTS risk_history (
    token_address TEXT NOT NULL,
    timestamp     INTEGER NOT NULL,
    risk_score    INTEGER NOT NULL,
    risk_level    TEXT NOT NULL,
    PRIMARY KEY (token_address, timestamp)
);
Risk Trend Computation
Δ
R
i
s
k
=
S
c
o
r
e
n
o
w
−
S
c
o
r
e
p
r
e
v
i
o
u
s
ΔRisk=Score 
now
​
 −Score 
previous
​
 
T
r
e
n
d
v
e
l
o
c
i
t
y
=
Δ
R
i
s
k
Δ
t
h
o
u
r
s
Trend 
velocity
​
 = 
Δt 
hours
​
 
ΔRisk
​
 
Trend Velocity	Label
< -5/24h	IMPROVING ↗
-5 to +5/24h	STABLE →
> +5/24h	DETERIORATING ↘
> +20/24h	CRITICAL ESCALATION ⚠
Output
text

RISK TREND: DETERIORATING ↘
  Yesterday: 35/100 (LOW RISK)
  Today:     78/100 (HIGH RISK)
  Velocity:  +43 in 24h (CRITICAL ESCALATION)
  Trigger:   Creator sold 60% of holdings since last scan
Rug Network Explorer ← NEW (Signature Feature)
File: [NEW] 
RugNetworkExplorer.js

TIP

This is the feature that transforms AntiRug from a rug checker into a Solana Threat Intelligence Platform. When a user scans a token, show them the entire scam network connected to it.

Output Format
When a user scans Token XYZ and it has connections to previous rugs:

text

═══════════════════════════════════════════
  RUG NETWORK EXPLORER
═══════════════════════════════════════════
Linked Projects:
  ✗ Token A — "MoonDog" (RUGGED — LP drained, 3 days ago)
  ✗ Token B — "SafeRocket" (RUGGED — creator exit, 2 weeks ago)
  ✗ Token C — "DiamondPaws" (ABANDONED — 0 liquidity, 1 month ago)
  ✓ Token D — "LegitCoin" (ACTIVE — 45 days old, healthy)
Shared Wallets:
  • Wallet 7xK...9f2 — held tokens A, B, C, and current
  • Wallet 3mR...1d8 — funded deployers of A and current
  • Wallet 9pL...4k7 — sniped tokens B, C, and current
Shared Funding Source:
  • Master Wallet 5tQ...8w3 — funded all 4 deployers
Entity:
  • Entity #E-0047 — 4 wallets, 3 rugs, 1 active
  • Entity Rug Rate: 75%
Network Risk: 92/100
═══════════════════════════════════════════
Implementation
On scan, look up creator in entity DB
Pull all wallets in same entity
Pull all tokens launched by those wallets
Pull all tokens where top holders overlap
Render linked project graph with status (rugged/abandoned/active)
Compute Network Risk = weighted average of entity rug rate + cross-token contamination
Confidence Engine 2.0
Evaluated inside: 
RiskScoringAgent.js
 [MODIFY]

Dimension	Weight
RPC Data Integrity	25%
Wallet Graph Depth	25%
Liquidity History Coverage	20%
Historical Data Coverage	15%
Social & Sentiment	15%
Output: Numeric score (0–100) + Tier (HIGH / MEDIUM / LOW).

Final User-Facing Output
When a user enters a CA, AntiRug returns:

text

═══════════════════════════════════════════════════
  RISK LEVEL: HIGH (87/100)
═══════════════════════════════════════════════════
Main Reasons:
  ✗ Creator cluster controls 52% of supply
  ✗ LP unlocked
  ✗ Creator launched 8 previous rugs (Rep: 12/100)
  ✗ 71% bundled supply in first block
  ✗ Liquidity dropped 35% in 6h
  ✗ Funded from known rug wallet
  ✗ Entity #E-0047 has 75% rug rate across 4 wallets
Risk Trend: DETERIORATING ↘
  Yesterday: 42 → Today: 87 (+45 in 24h)
  Trigger: Creator sold 60% of holdings
Confidence: 92/100 (HIGH)
Historical Similarity:
  84% similar to previously rugged tokens
Rug Network:
  3 linked rugged projects detected
  5 shared insider wallets
  Network Risk: 92/100
Recommendation:
  Avoid entry. Creator entity has established
  pattern of launching and rugging within 14 days.
═══════════════════════════════════════════════════
Phased Execution Roadmap
Phase 1: Core Engine Refactor (Priority: CRITICAL)
Action	File	Description
MODIFY	
RiskScoringAgent.js
Implement 11-layer weighted aggregation with new weights. Fix existing syntax error (duplicate return).
MODIFY	
CriticalOverrideEngine.js
Implement all 11 floor-based override rules (including entity and cross-token overrides).
Phase 2: Structural & Liquidity Layers
Action	File	Description
MODIFY	
AuthorityRiskEngine.js
Add Token2022 extension checks. Adjust to 8% weight.
MODIFY	
LPLockAnalyzer.js
Add LP ownership analysis. Support Raydium Lock, UNCX, Team Finance.
MODIFY	
LiquidityShockAgent.js
Add exit slippage simulation + dry-run sell simulation (Jupiter swap simulation).
Phase 3: Intelligence Layers (Wallet, Launch, Deployer)
Action	File	Description
MODIFY	
WalletRelationshipGraph.js
Union-Find clustering, CSR formula, circular transfer detection, cross-token relationship engine.
MODIFY	
SmartMoneyTracker.js
Cross-reference against smart_wallets.json. Track entry/exit signals.
MODIFY	
BundlerDetector.js
Jito bundle detection, shared tip payer analysis.
MODIFY	
SniperDominanceScorer.js
Block-level supply capture analysis (Block 1/5/20).
MODIFY	
InsiderWalletScorer.js
4-tier creator exit risk table.
MODIFY	
DeployerReputationDatabase.js
Add last_seen column. Implement time-decay reputation formula.
Phase 4: New Modules (The 10/10 Upgrades)
Action	File	Description
NEW	
FundingIntelligenceTracker.js
SOL origin tracing. Exchange vs fresh wallet vs mixer classification. 8% weight.
NEW	
EntityIntelligenceEngine.js
Entity resolution from funding ancestry + temporal clustering + cross-token overlap. Entity DB (SQLite). 5% weight.
NEW	
RiskTrendEngine.js
Historical scan storage. Trend velocity computation. Escalation detection.
NEW	
RugNetworkExplorer.js
Cross-project linking. Shared wallet detection. Network risk scoring. Visual output.
NEW	
HistoricalSimilarityEngine.js
Feature extraction. Nearest-neighbor comparison. Evidence-only output.
NEW	
rug_dataset.json
Initial dataset of known rugged and clean token feature vectors.
Phase 5: Scanner & Integration
Action	File	Description
MODIFY	
token_scanner_agent.py
Collect all new fields: Token2022 extensions, LP ownership %, funding source, block-level buy data, dry-run sell result.
MODIFY	
server.js
Wire all 11 layers + Risk Trend + Rug Network Explorer into pipeline. Update SSE events and final report format.
MODIFY	
BlockchainRiskAnalysisAgent.js
Refactor to focus on Holder Intelligence (Layer 3) with Gini coefficient and holder growth slopes. 8% weight.
MODIFY	
SentimentAnalysisAgent.js
Add X account age, domain age, GitHub verification. Cap at 2% weight.
Phase 6: Verification & Polish
Action	Description
Test	Run node testFullPipeline.js against known safe token → expect score ≤ 20.
Test	Run against known rug token (bundled + unlocked LP) → expect score ≥ 90.
Test	Run against token with active mint authority → expect override floor = 85.
Test	Run against token from serial rugger → expect deployer reputation override = 95.
Test	Run dry-run sell against known honeypot → expect risk = 100.
Test	Run against token from known entity with 3 prior rugs → expect entity override = 95.
Test	Run 2 scans on same token with creator selling between scans → verify risk trend shows DETERIORATING.
Phase 7: Frontend Updates
Action	File	Description
MODIFY	
ResultsDashboard.jsx
Add Risk Trend display + Rug Network Explorer panel.
MODIFY	
ScanReportCard.jsx
Update to show 11 layers, entity info, and network connections.
NEW	NetworkExplorerCard.jsx	Visual graph component showing linked projects, shared wallets, and entity relationships.
NEW	RiskTrendChart.jsx	Time-series chart showing risk score evolution over multiple scans.
Summary: The 6 Upgrades That Make This a 10/10
#	Upgrade	What It Solves	Where It Lives
1	Entity Intelligence	Scammers rotate wallets — track the actor, not the wallet	Layer 11 (5%)
2	Cross-Token Relationship Engine	Catches organized rug groups operating across multiple tokens	Layer 4 enhancement
3	Dry-Run Sell Simulation	Detects honeypots, hidden taxes, transfer restrictions	Layer 2 enhancement
4	Risk Trend Engine	Shows risk trajectory, not just current snapshot	Post-aggregation
5	Reputation Time Decay	Prevents permanent punishment for reformed deployers	Layer 6 enhancement
6	Rug Network Explorer	Visualizes the entire scam network connected to a token	Signature feature
The Competitive Moat
TIP

AntiRug's moat is not a feature — it's a dataset. Every scan grows the Deployer Reputation DB, the Entity DB, and the Rug Dataset. Every rug that AntiRug observes makes the system smarter. This is a compounding advantage that no competitor can replicate without running the same scans over the same time period.

Most scanners analyze tokens. AntiRug analyzes people and networks.

A scammer can create 100 new tokens. They cannot erase their on-chain history. AntiRug remembers.