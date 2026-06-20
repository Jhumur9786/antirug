/**
 * DeployerReputationDatabase — Tracks deployer launch history and computes reputation scores.
 * Uses better-sqlite3 for local storage.
 *
 * Database name: deployers.db
 */

const Database = require("better-sqlite3");
const path = require("path");

class DeployerReputationDatabase {
    constructor() {
        const dbPath = path.resolve(__dirname, "deployers.db");
        this.db = new Database(dbPath);
        this.init();
    }

    /**
     * Initialize the database schema if it doesn't exist.
     */
    init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS deployers (
                creator_address TEXT PRIMARY KEY,
                first_seen INTEGER NOT NULL,
                total_launches INTEGER DEFAULT 1,
                rugged_launches INTEGER DEFAULT 0,
                clean_launches INTEGER DEFAULT 0,
                avg_pool_lifespan_sec INTEGER DEFAULT 0,
                max_ath_mcap REAL DEFAULT 0.0,
                reputation_score INTEGER DEFAULT 50
            );

            CREATE TABLE IF NOT EXISTS historical_tokens (
                token_address TEXT PRIMARY KEY,
                creator_address TEXT NOT NULL,
                launch_time INTEGER NOT NULL,
                peak_mcap REAL DEFAULT 0.0,
                end_mcap REAL DEFAULT 0.0,
                lifespan_sec INTEGER DEFAULT 0,
                status TEXT NOT NULL, -- 'RUGGED', 'CLEAN', 'ACTIVE'
                FOREIGN KEY(creator_address) REFERENCES deployers(creator_address)
            );
        `);
    }

    /**
     * Retrieves the reputation metrics for a deployer.
     * Calculates the risk score based on the reputation formula.
     *
     * @param {string} creatorAddress - Base58 address of the token creator
     * @returns {Object} Deployer reputation & computed risk metrics
     */
    getReputation(creatorAddress) {
        if (!creatorAddress) {
            return {
                deployer_risk_score: 40, // Default baseline for missing creator wallet
                total_launches: 0,
                rugged_launches: 0,
                clean_launches: 0,
                reputation_score: 50,
                status: "NEW"
            };
        }

        const row = this.db.prepare("SELECT * FROM deployers WHERE creator_address = ?").get(creatorAddress);

        if (!row) {
            return {
                deployer_risk_score: 40, // Neutral-caution baseline for brand new wallets
                total_launches: 0,
                rugged_launches: 0,
                clean_launches: 0,
                reputation_score: 50,
                status: "NEW"
            };
        }

        const total = row.total_launches || 0;
        const rugged = row.rugged_launches || 0;
        const clean = row.clean_launches || 0;

        let reputationScore = 50;
        let riskScore = 40;

        if (total > 0) {
            // Rep = 100 * (1 - RugLaunches / TotalLaunches) * (1 - e^(-TotalLaunches / 5))
            const rugRatio = rugged / total;
            const expFactor = 1 - Math.exp(-total / 5);
            reputationScore = Math.round(100 * (1 - rugRatio) * expFactor);

            // Risk = 100 - Reputation
            riskScore = 100 - reputationScore;

            // If they have clean launches but no rugs, scale down the default risk based on launches
            if (rugged === 0) {
                riskScore = Math.max(10, 40 - total * 10);
            }
        }

        return {
            deployer_risk_score: riskScore,
            total_launches: total,
            rugged_launches: rugged,
            clean_launches: clean,
            reputation_score: reputationScore,
            status: total >= 3 ? (reputationScore < 40 ? "KNOWN_SCAMMER" : "ESTABLISHED") : "INSUFFICIENT_HISTORY"
        };
    }

    /**
     * Inserts or updates a deployer launch in the database.
     * Automatically adjusts aggregates.
     *
     * @param {string} creatorAddress - Creator base58 address
     * @param {string} tokenAddress - Scanned token address
     * @param {boolean} isRugged - Whether the scanned token was determined to be a rug
     */
    recordLaunch(creatorAddress, tokenAddress, isRugged) {
        if (!creatorAddress || !tokenAddress) return;

        const now = Math.floor(Date.now() / 1000);
        const status = isRugged ? "RUGGED" : "ACTIVE";

        this.db.transaction(() => {
            // 1. Insert or update token record
            this.db.prepare(`
                INSERT INTO historical_tokens (token_address, creator_address, launch_time, status)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(token_address) DO UPDATE SET status = EXCLUDED.status
            `).run(tokenAddress, creatorAddress, now, status);

            // 2. Insert or update deployer record
            const deployer = this.db.prepare("SELECT * FROM deployers WHERE creator_address = ?").get(creatorAddress);

            if (!deployer) {
                this.db.prepare(`
                    INSERT INTO deployers (creator_address, first_seen, total_launches, rugged_launches, clean_launches)
                    VALUES (?, ?, 1, ?, ?)
                `).run(creatorAddress, now, isRugged ? 1 : 0, isRugged ? 0 : 1);
            } else {
                // Fetch all tokens from this deployer to calculate aggregates
                const tokens = this.db.prepare("SELECT status FROM historical_tokens WHERE creator_address = ?").all(creatorAddress);
                const total = tokens.length;
                const ruggedCount = tokens.filter(t => t.status === "RUGGED").length;
                const cleanCount = total - ruggedCount;

                this.db.prepare(`
                    UPDATE deployers
                    SET total_launches = ?,
                        rugged_launches = ?,
                        clean_launches = ?
                    WHERE creator_address = ?
                `).run(total, ruggedCount, cleanCount, creatorAddress);
            }
        })();
    }
}

module.exports = new DeployerReputationDatabase();
