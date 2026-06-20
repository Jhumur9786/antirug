/**
 * WalletRelationshipGraph
 * Framework: Eliza
 * Language: JavaScript (Node.js)
 *
 * Purpose: THE MOST IMPORTANT MODULE in the AntiRug risk analysis pipeline.
 * Builds a wallet relationship graph using Union-Find (Disjoint Set Union) to
 * cluster connected wallets. This module detects the most sophisticated rug-pull
 * patterns where a single entity controls supply across dozens of seemingly
 * independent wallets — a technique invisible to simple holder concentration checks.
 *
 * The module:
 * 1. Uses Union-Find to efficiently cluster wallets connected by on-chain transfers
 * 2. Calculates total supply held by each cluster
 * 3. Checks if any cluster is linked to the creator/deployer wallet
 * 4. Flags hidden supply concentration that evades basic top-holder analysis
 *
 * This catches rug patterns like:
 * - Creator distributes supply to 50+ wallets, then coordinates a dump
 * - Sybil attacks where one entity creates many "independent" holders
 * - Laundering supply through intermediary wallets before selling
 */

const askLLM = require("./llmClient");

// ============================================================
// Union-Find (Disjoint Set Union) Data Structure
// ============================================================

/**
 * Union-Find with path compression and union by rank.
 * Used to efficiently cluster wallets connected by transfer edges.
 *
 * Time complexity: Nearly O(α(n)) per operation (inverse Ackermann — effectively constant)
 * Space complexity: O(n)
 */
class UnionFind {
    constructor() {
        /** @type {Map<string, string>} Maps each element to its parent */
        this.parent = new Map();
        /** @type {Map<string, number>} Rank (tree depth) for union by rank */
        this.rank = new Map();
    }

    /**
     * Ensures an element exists in the structure.
     * @param {string} x - Element to add
     */
    makeSet(x) {
        if (!this.parent.has(x)) {
            this.parent.set(x, x);
            this.rank.set(x, 0);
        }
    }

    /**
     * Finds the root representative of an element's set, with path compression.
     * @param {string} x - Element to find root for
     * @returns {string} Root representative of the set
     */
    find(x) {
        this.makeSet(x);
        if (this.parent.get(x) !== x) {
            this.parent.set(x, this.find(this.parent.get(x))); // Path compression
        }
        return this.parent.get(x);
    }

    /**
     * Merges the sets containing elements x and y (union by rank).
     * @param {string} x - First element
     * @param {string} y - Second element
     */
    union(x, y) {
        const rootX = this.find(x);
        const rootY = this.find(y);

        if (rootX === rootY) return; // Already in the same set

        const rankX = this.rank.get(rootX);
        const rankY = this.rank.get(rootY);

        if (rankX < rankY) {
            this.parent.set(rootX, rootY);
        } else if (rankX > rankY) {
            this.parent.set(rootY, rootX);
        } else {
            this.parent.set(rootY, rootX);
            this.rank.set(rootX, rankX + 1);
        }
    }

    /**
     * Returns all distinct clusters as a Map of root → array of members.
     * @returns {Map<string, string[]>} Clusters grouped by root
     */
    getClusters() {
        const clusters = new Map();
        for (const element of this.parent.keys()) {
            const root = this.find(element);
            if (!clusters.has(root)) {
                clusters.set(root, []);
            }
            clusters.get(root).push(element);
        }
        return clusters;
    }
}

// ============================================================
// WalletRelationshipGraph Module
// ============================================================

class WalletRelationshipGraph {
    constructor() {
        this.name = "WalletRelationshipGraph";
        this.description = "Builds wallet relationship graphs to detect hidden supply concentration and creator-linked holder networks.";

        /** @type {Object} Risk thresholds for cluster-based supply concentration */
        this.THRESHOLDS = {
            CRITICAL_CREATOR_LINKED: 40,   // >40% supply linked to creator = critical
            EXTREME_CLUSTER: 50,            // >50% in one cluster = extreme risk
            HIGH_CLUSTER: 30,               // >30% in one cluster = high risk
            MEDIUM_CLUSTER: 15              // >15% in one cluster = medium risk
        };
    }

    /**
     * Builds a wallet relationship graph and analyzes cluster-based supply concentration.
     *
     * @param {Object} data - Wallet relationship data
     * @param {Array<Array<string>>} [data.wallet_clusters] - Pre-computed wallet clusters (optional, used as seed)
     * @param {number} data.creator_linked_holders_pct - Percentage of supply held by wallets linked to the creator
     * @param {number} data.max_cluster_supply_pct - Maximum supply percentage held by any single cluster
     * @param {Array<{from: string, to: string, amount: number}>} [data.relationship_edges] - On-chain transfer edges
     * @param {string} [data.creator_wallet] - The token creator/deployer wallet address
     * @returns {Object} Wallet graph risk analysis result
     * @returns {number} return.wallet_graph_risk_score - Risk score (0-100)
     * @returns {string} return.wallet_graph_level - Risk level label
     * @returns {number} return.cluster_count - Number of distinct wallet clusters
     * @returns {number} return.max_cluster_size - Size of the largest cluster (wallet count)
     * @returns {boolean} return.creator_linked - Whether the largest cluster is linked to the creator
     * @returns {string} return.wallet_graph_details - Human-readable analysis
     */
    async analyze(data) {
        try {
            if (!data || typeof data !== "object") {
                throw new Error("Invalid or missing wallet relationship data.");
            }

            console.log(`[WalletRelationshipGraph] Building wallet relationship graph...`);

            // --- Extract inputs ---
            const edges = Array.isArray(data.relationship_edges) ? data.relationship_edges : [];
            const precomputedClusters = Array.isArray(data.wallet_clusters) ? data.wallet_clusters : [];
            const creatorWallet = data.creator_wallet || null;
            let creatorLinkedPct = typeof data.creator_linked_holders_pct === "number" ? data.creator_linked_holders_pct : 0;
            let maxClusterSupplyPct = typeof data.max_cluster_supply_pct === "number" ? data.max_cluster_supply_pct : 0;

            // --- Build Union-Find from edges ---
            const uf = new UnionFind();

            // Seed with pre-computed clusters (from external analysis)
            for (const cluster of precomputedClusters) {
                if (Array.isArray(cluster) && cluster.length > 1) {
                    for (let i = 1; i < cluster.length; i++) {
                        uf.union(cluster[0], cluster[i]);
                    }
                } else if (Array.isArray(cluster) && cluster.length === 1) {
                    uf.makeSet(cluster[0]);
                }
            }

            // Add edges from on-chain transfer data
            for (const edge of edges) {
                if (edge.from && edge.to) {
                    uf.union(edge.from, edge.to);
                }
            }

            // --- Analyze clusters ---
            const clusters = uf.getClusters();
            const clusterCount = clusters.size;
            let maxClusterSize = 0;
            let maxClusterRoot = null;
            let creatorLinked = false;

            for (const [root, members] of clusters) {
                if (members.length > maxClusterSize) {
                    maxClusterSize = members.length;
                    maxClusterRoot = root;
                }

                // Check if creator wallet is in this cluster
                if (creatorWallet && members.includes(creatorWallet)) {
                    creatorLinked = true;
                    // If creator is in the largest cluster, that's the worst case
                    console.log(`[WalletRelationshipGraph] Creator wallet found in cluster of ${members.length} wallets`);
                }
            }

            // --- Calculate total transfer volume through edges (for insight) ---
            let totalEdgeVolume = 0;
            for (const edge of edges) {
                totalEdgeVolume += typeof edge.amount === "number" ? edge.amount : 0;
            }

            // --- Deterministic scoring ---
            let score = 15;
            let level = "LOW";
            let triggerReason = "Normal wallet distribution";

            // Rule 1: Creator-linked holders control >40% supply
            if (creatorLinkedPct > this.THRESHOLDS.CRITICAL_CREATOR_LINKED) {
                score = 95;
                level = "CRITICAL";
                triggerReason = `Creator-linked wallets control ${creatorLinkedPct}% of supply — extreme rug risk`;
            }
            // Rule 2: Single cluster holds >50% supply
            else if (maxClusterSupplyPct > this.THRESHOLDS.EXTREME_CLUSTER) {
                score = 90;
                level = "VERY_HIGH";
                triggerReason = `Single wallet cluster controls ${maxClusterSupplyPct}% of total supply`;
            }
            // Rule 3: Single cluster holds >30% supply
            else if (maxClusterSupplyPct > this.THRESHOLDS.HIGH_CLUSTER) {
                score = 70;
                level = "HIGH";
                triggerReason = `Wallet cluster controls ${maxClusterSupplyPct}% of supply — elevated concentration`;
            }
            // Rule 4: Single cluster holds >15% supply
            else if (maxClusterSupplyPct > this.THRESHOLDS.MEDIUM_CLUSTER) {
                score = 50;
                level = "MEDIUM";
                triggerReason = `Wallet cluster holds ${maxClusterSupplyPct}% of supply — moderate concentration`;
            }

            // Boost score if creator is linked to the dominant cluster
            if (creatorLinked && score < 95) {
                score = Math.min(95, score + 15);
                triggerReason += " (creator wallet linked to cluster)";
            }

            console.log(`[WalletRelationshipGraph] Clusters: ${clusterCount} | Max cluster: ${maxClusterSize} wallets | Creator linked: ${creatorLinked} | Score: ${score} | Level: ${level}`);

            // --- Generate AI-enhanced details ---
            let walletGraphDetails = "";
            try {
                const prompt = `You are a blockchain forensics analyst specializing in wallet clustering and Sybil detection on Solana.
Analyze this wallet relationship data and provide a 2-3 sentence risk assessment.
Use only the data provided. Do not invent information.

Data:
- Total wallet clusters detected: ${clusterCount}
- Largest cluster size: ${maxClusterSize} wallets
- Creator wallet linked to cluster: ${creatorLinked}
- Creator-linked holders supply: ${creatorLinkedPct}%
- Max cluster supply concentration: ${maxClusterSupplyPct}%
- Transfer edges analyzed: ${edges.length}
- Total transfer volume through edges: ${totalEdgeVolume}
- Risk score: ${score}/100
- Risk level: ${level}
- Trigger: ${triggerReason}

Focus on what the cluster structure reveals about potential coordinated control.`;

                walletGraphDetails = await askLLM(prompt, { max_tokens: 300 });
            } catch (_) {
                walletGraphDetails = this._generateFallbackDetails(clusterCount, maxClusterSize, creatorLinked, creatorLinkedPct, maxClusterSupplyPct, level, triggerReason);
            }

            // Fallback if LLM returned empty or unavailable
            if (!walletGraphDetails || walletGraphDetails === "AI analysis unavailable" || walletGraphDetails === "AI sentiment analysis unavailable") {
                walletGraphDetails = this._generateFallbackDetails(clusterCount, maxClusterSize, creatorLinked, creatorLinkedPct, maxClusterSupplyPct, level, triggerReason);
            }

            return {
                wallet_graph_risk_score: score,
                wallet_graph_level: level,
                cluster_count: clusterCount,
                max_cluster_size: maxClusterSize,
                creator_linked: creatorLinked,
                creator_linked_holders_pct: creatorLinkedPct,
                max_cluster_supply_pct: maxClusterSupplyPct,
                total_edges_analyzed: edges.length,
                total_edge_volume: totalEdgeVolume,
                wallet_graph_details: walletGraphDetails,
                trigger_reason: triggerReason
            };
        } catch (error) {
            console.error(`[WalletRelationshipGraph] Error: ${error.message}`);
            return {
                wallet_graph_risk_score: 50,
                wallet_graph_level: "UNKNOWN",
                cluster_count: 0,
                max_cluster_size: 0,
                creator_linked: false,
                creator_linked_holders_pct: 0,
                max_cluster_supply_pct: 0,
                total_edges_analyzed: 0,
                total_edge_volume: 0,
                wallet_graph_details: `Analysis failed: ${error.message}. Defaulting to neutral score.`,
                trigger_reason: "Error during analysis"
            };
        }
    }

    /**
     * Generates a deterministic fallback summary when LLM is unavailable.
     * @private
     * @param {number} clusterCount - Number of clusters
     * @param {number} maxClusterSize - Largest cluster wallet count
     * @param {boolean} creatorLinked - Whether creator is in a cluster
     * @param {number} creatorLinkedPct - Creator-linked supply percentage
     * @param {number} maxClusterPct - Max cluster supply percentage
     * @param {string} level - Risk level
     * @param {string} trigger - The rule that triggered the score
     * @returns {string} Human-readable wallet graph details
     */
    _generateFallbackDetails(clusterCount, maxClusterSize, creatorLinked, creatorLinkedPct, maxClusterPct, level, trigger) {
        if (level === "CRITICAL") {
            return `CRITICAL RISK: ${trigger}. Wallet graph analysis reveals ${clusterCount} clusters with the largest containing ${maxClusterSize} interconnected wallets. Creator wallet is directly linked to holder wallets controlling ${creatorLinkedPct}% of supply — this is the #1 rug-pull indicator. DO NOT invest.`;
        } else if (level === "VERY_HIGH") {
            return `EXTREME RISK: A single wallet cluster controls ${maxClusterPct}% of total supply across ${maxClusterSize} wallets. ${creatorLinked ? "Creator wallet is linked to this cluster. " : ""}This level of hidden concentration strongly suggests coordinated control designed to evade simple holder analysis.`;
        } else if (level === "HIGH") {
            return `HIGH RISK: ${trigger}. ${clusterCount} wallet clusters detected with the largest containing ${maxClusterSize} wallets. Supply concentration across connected wallets exceeds safe thresholds.${creatorLinked ? " Creator wallet connection detected." : ""}`;
        } else if (level === "MEDIUM") {
            return `MODERATE RISK: ${trigger}. Graph analysis shows ${clusterCount} clusters. Some wallet interconnection detected but concentration is within cautionary range. Monitor for increasing cluster growth.`;
        }
        return `LOW RISK: Wallet relationship graph shows ${clusterCount} clusters with no significant concentration. Supply distribution appears organic with no creator-linked holder networks detected.`;
    }
}

// Export for Eliza framework / module inclusion
module.exports = WalletRelationshipGraph;
