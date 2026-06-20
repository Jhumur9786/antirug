const OpenAI = require("openai");

// AlertAgent for AntiRug Multi-Agent Security Pipeline
// converts AI risk predictions into security alerts and recommendations.
class AlertAgent {
    constructor() {
        const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
        const config = apiKey ? { apiKey } : null;
        if (config && process.env.OPENAI_BASE_URL) config.baseURL = process.env.OPENAI_BASE_URL;
        this.openai = config ? new OpenAI(config) : null;
    }

    /**
     * Wraps a promise with a timeout.
     */
    _withTimeout(promise, ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`LLM request timed out after ${ms}ms`)), ms);
            promise.then(value => { clearTimeout(timer); resolve(value); })
                   .catch(err => { clearTimeout(timer); reject(err); });
        });
    }

    /**
     * Generate a complete security alert from upstream pipeline data.
     * @param {Object} input - { risk_score, prediction }
     */
    async generateAlert(input) {
        try {
            if (!input || !input.risk_score || !input.prediction) {
                throw new Error("Missing required pipeline data (risk_score or prediction)");
            }

            const rs = input.risk_score;
            const pr = input.prediction;

            // ── Feature Extraction ─────────────────────────────────────
            const token_id = rs.token_id || pr.token_id || "Unknown";
            const rug_risk_score = rs.rug_risk_score ?? 0;
            const final_risk_level = rs.risk_level || "LOW";
            const rug_probability = pr.rug_probability ?? 0;
            const confidence_score = pr.ai_confidence ?? 0;
            const key_triggers = pr.key_triggers || [];
            
            // 9 ADD ALERT SCORE always matches final_risk_score
            // rs.final_risk_score has the RiskScoringAgent final risk. If not, fallback to rug_risk_score.
            const alert_score = rs.final_risk_score !== undefined ? rs.final_risk_score : rug_risk_score;

            // 1 ALERT CLASSIFICATION
            const alert_level = this._resolveAlertLevel(alert_score);

            // ── Alert Trigger Rules ────────────────────────────────────
            const alert_triggered = this._evaluateTrigger(rug_probability, final_risk_level, key_triggers, alert_score);

            // 2 ALERT TYPE DETECTION
            const alert_type = this._classifyAlertType(rs.primary_risk_factor, rs.top_risk_factors, rs.risk_velocity, key_triggers);

            // 3 PRIMARY WARNING ENGINE
            const primary_warning = this._buildPrimaryWarning(key_triggers, final_risk_level, rug_probability);

            // Risk Summary (existing logic updated)
            const risk_summary = this._buildRiskSummary(alert_score, key_triggers);

            // 4 SECURITY POSTURE
            const security_posture = this._resolveSecurityPosture(final_risk_level);

            // 5 MONITORING STATUS
            const monitoring_status = this._resolveMonitoringStatus(alert_score);

            // 8 AI ALERT CONFIDENCE
            const ai_confidence = Math.max(0, Math.min(100, Math.round(confidence_score)));

            // ── AI Alert Generation ────────────────────────────────────
            // 12 ADD FALLBACK AI STRUCTURE (default values)
            let ai_alert_summary = "AI alert analysis unavailable. Deterministic monitoring active.";
            let recommendations = ["Monitor token activity"];
            let alert_generation_mode = "DETERMINISTIC_ONLY";

            // If we have openai
            if (this.openai && alert_triggered) {
                try {
                    const prompt = `
Token ID: ${token_id}
Alert Level: ${alert_level}
Triggers: ${key_triggers.join(", ") || "None"}
Primary Warning: ${primary_warning}

You are a blockchain security monitoring system.
Generate a JSON object with exactly two keys:
1. "ai_alert_summary": Explain why the alert triggered, the main danger, and what investors should watch (2-3 sentences max).
2. "recommendations": Array of exactly 3 concise, actionable security actions.
Do NOT hallucinate. Do not use markdown inside values. Return only the JSON object.`;

                    // typical model as per repo usage
                    const response = await this._withTimeout(this.openai.chat.completions.create({
                        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.2,
                        max_tokens: 800,
                        response_format: { type: "json_object" }
                    }), 15000);

                    let content = response.choices[0].message.content || "{}";
                    // Strip markdown
                    content = content.replace(/```json/g, "").replace(/```/g, "").trim();
                    const start = content.indexOf('{');
                    const end = content.lastIndexOf('}');
                    if (start !== -1 && end !== -1) {
                        content = content.substring(start, end + 1);
                    }
                    
                    // Parse safely
                    const parsed = JSON.parse(content);
                    
                    if (parsed.ai_alert_summary) ai_alert_summary = parsed.ai_alert_summary;
                    if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
                        recommendations = parsed.recommendations.slice(0, 3);
                        // pad missing to 3
                        while (recommendations.length < 3) recommendations.push("Monitor token activity");
                    } else if (Array.isArray(parsed.recommendations)) {
                        recommendations = ["Monitor token activity", "Review token periodically", "Watch for large transfers"];
                    }
                    
                    // 10 ADD DECISION MODE
                    alert_generation_mode = "HYBRID_AI";
                } catch (e) {
                    console.warn("[AlertAgent] AI generation failed, using deterministic fallback.", e.message);
                }
            } else if (!alert_triggered) {
                ai_alert_summary = "Token risk is below alert thresholds. No immediate danger detected.";
                recommendations = ["Continue standard security monitoring", "Review token periodically", "Watch for sudden liquidity drops"];
            }

            // 13 PROFESSIONAL OUTPUT STRUCTURE
            return {
                token_id,
                alert_triggered,
                alert_level,
                alert_type,
                primary_warning,
                risk_summary,
                security_posture,
                monitoring_status,
                alert_score,
                ai_alert_summary,
                recommendations,
                ai_confidence,
                alert_generation_mode
            };

        } catch (error) {
            // fallback protection - 11 ALERT STABILITY SAFETY
            console.error("[AlertAgent] Critical generation failure:", error.message);
            const token_id = input?.prediction?.token_id || input?.risk_score?.token_id || "Unknown";
            const confidence_score = input?.prediction?.ai_confidence ?? 0;
            
            // 12 FALLBACK AI STRUCTURE
            return {
                token_id,
                alert_triggered: false,
                alert_level: "INFO",
                alert_type: "RISK_MONITOR",
                primary_warning: "Monitoring active. No critical threats processed.",
                risk_summary: "System error during alert processing. Defaulting to safe values.",
                security_posture: "CAUTION",
                monitoring_status: "WATCHLIST",
                alert_score: 0,
                ai_alert_summary: "AI alert analysis unavailable. Deterministic monitoring active.",
                recommendations: ["Monitor token activity"],
                ai_confidence: Math.max(0, Math.min(100, Math.round(confidence_score))),
                alert_generation_mode: "DETERMINISTIC_ONLY"
            };
        }
    }

    // ── Private Helpers (deterministic alert logic) ────────────────────

    // 1 ALERT CLASSIFICATION
    _resolveAlertLevel(score) {
        if (score >= 86) return "CRITICAL";
        if (score >= 66) return "HIGH";
        if (score >= 46) return "MEDIUM";
        if (score >= 26) return "LOW";
        return "INFO";
    }

    _evaluateTrigger(prob, riskLevel, triggers, score) {
        // prob is 0-100 percentage, not 0-1 decimal
        if (prob > 40 || score > 45) return true;
        if (["MEDIUM", "HIGH", "CRITICAL", "VERY_HIGH"].includes(riskLevel)) return true;
        const criticalTriggers = ["Active mint authority", "Admin control vulnerability", "Treasury concentration",
            "Token supply can be increased by admin", "Centralized administrative control detected",
            "Treasury wallet concentration detected"];
        return triggers.some(t => criticalTriggers.includes(t));
    }

    // 2 ALERT TYPE DETECTION
    _classifyAlertType(primaryRiskFactor = "", topRiskFactors = [], riskVelocity = 0, keyTriggers = []) {
        const factorStr = `${primaryRiskFactor} ${topRiskFactors.join(" ")} ${keyTriggers.join(" ")}`.toLowerCase();
        
        if (factorStr.includes("mint") || factorStr.includes("admin") || factorStr.includes("governance") || factorStr.includes("control")) {
            return "GOVERNANCE_RISK";
        }
        if (factorStr.includes("liquid") || factorStr.includes("pool") || factorStr.includes("slippage")) {
            return "LIQUIDITY_RISK";
        }
        if (factorStr.includes("sentiment") || factorStr.includes("community") || factorStr.includes("fud")) {
            return "SENTIMENT_RISK";
        }
        if (factorStr.includes("rug") || factorStr.includes("scam") || factorStr.includes("dump")) {
            return "RUG_WARNING";
        }
        return "RISK_MONITOR";
    }

    // 3 PRIMARY WARNING ENGINE
    _buildPrimaryWarning(triggers, riskLevel, prob) {
        // Map both the short labels AND the full trigger strings from RugPredictorAgent
        const map = {
            "Active mint authority": "Token has active mint authority creating supply inflation risk.",
            "Token supply can be increased by admin": "Token has active mint authority creating supply inflation risk.",
            "Treasury concentration": "Large treasury concentration detected — potential dump vector.",
            "Treasury wallet concentration detected": "Large treasury concentration detected — potential dump vector.",
            "Admin control vulnerability": "Admin key present allowing unilateral contract changes.",
            "Centralized administrative control detected": "Admin key present allowing unilateral contract changes.",
            "Low liquidity depth": "Insufficient liquidity depth increases exit slippage risk.",
            "Critically low liquidity depth": "Insufficient liquidity depth increases exit slippage risk.",
            "Holder concentration": "Whale-dominated holder distribution creates price manipulation risk.",
            "High holder concentration": "Whale-dominated holder distribution creates price manipulation risk.",
            "Developer inactivity": "No recent developer activity signals possible project abandonment.",
            "Significant developer inactivity": "No recent developer activity signals possible project abandonment.",
            "Negative sentiment trend": "Negative community sentiment increasing volatility risk.",
            "Negative community sentiment": "Negative community sentiment increasing volatility risk."
        };
        for (const t of triggers) {
            if (map[t]) return map[t];
        }
        // prob is 0-100 percentage, not 0-1 decimal
        if (riskLevel === "CRITICAL" || riskLevel === "VERY_HIGH" || prob > 75) return "Token exhibits critical security indicators — immediate review recommended.";
        if (riskLevel === "HIGH" || prob > 50) return "Elevated risk signals detected across multiple security vectors.";
        if (riskLevel === "MEDIUM" || prob > 30) return "Moderate risk indicators present — continued monitoring advised.";
        return "Token security profile within acceptable parameters.";
    }

    _buildRiskSummary(score, triggers) {
        const triggerStr = triggers.length > 0 ? triggers.join(", ").toLowerCase() : "general risk factors";
        if (score >= 86) return `Critical rug risk (score: ${score}) driven by ${triggerStr}. Immediate action required.`;
        if (score >= 66) return `High rug risk (score: ${score}) due to ${triggerStr}. Enhanced monitoring active.`;
        if (score >= 46) return `Moderate rug risk (score: ${score}) due to ${triggerStr}. Standard monitoring in place.`;
        return `Low rug risk (score: ${score}). No significant threats identified at this time.`;
    }

    // 4 SECURITY POSTURE
    _resolveSecurityPosture(level) {
        if (level === "VERY_HIGH" || level === "CRITICAL") return "CRITICAL";
        if (level === "HIGH") return "DANGEROUS";
        if (level === "MEDIUM") return "CAUTION";
        return "SAFE";
    }

    // 5 MONITORING STATUS
    _resolveMonitoringStatus(score) {
        if (score > 45) return "ACTIVE_MONITORING";
        if (score >= 25) return "WATCHLIST";
        return "NO_ALERT";
    }
}

module.exports = AlertAgent;
