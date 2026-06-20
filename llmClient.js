require("dotenv").config();
const OpenAI = require("openai");

let openai = null;

/**
 * Lazily initializes the OpenAI client.
 * This prevents a crash at require-time when OPENAI_API_KEY is not set.
 */
function getClient() {
  if (!openai) {
    const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return null;
    }
    const baseURL = process.env.OPENAI_BASE_URL;
    const config = { apiKey };
    if (baseURL) {
      config.baseURL = baseURL;
    }
    openai = new OpenAI(config);
  }
  return openai;
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve
 * within `ms` milliseconds, it rejects with a timeout error.
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`LLM request timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Send a prompt to an LLM. Defaults to gpt-4o-mini.
 *
 * @param {string} prompt - The analysis prompt
 * @param {Object} options - Custom generation parameters
 * @returns {string} The LLM response text, or a fallback message on failure
 */
async function askLLM(prompt, options = {}) {
  try {
    const client = getClient();
    if (!client) {
      console.warn("[LLM WARNING] OPENAI_API_KEY not configured — skipping AI analysis");
      return "AI sentiment analysis unavailable";
    }

    const payload = {
        model: options.model || process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: options.system || "You are a crypto market sentiment analyst specializing in rug pull detection."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: options.temperature !== undefined ? options.temperature : 0.2,
        max_tokens: options.max_tokens || 500
    };

    if (options.response_format) {
        payload.response_format = options.response_format;
    }

    const response = await withTimeout(
      client.chat.completions.create(payload),
      options.timeout || 15000 // 15-second default timeout
    );

    return response.choices[0].message.content;
  } catch (error) {
    console.warn(`[LLM WARNING] ${error.message}`);
    if (options.throwOnError) throw error; // Allow catching in multi-agent loops
    return "AI analysis unavailable";
  }
}

module.exports = askLLM;
