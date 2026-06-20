const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
const OPENAI_SMALL_MODEL = "gpt-4o-mini";
const OPENAI_LARGE_MODEL = "gpt-4o";

function hasGroqKey() {
    return Boolean(process.env.GROQ_API_KEY);
}

function getLLMProvider() {
    if (hasGroqKey()) return "groq";
    if (process.env.OPENAI_API_KEY) return "openai";
    return "none";
}

function getLLMProviderLabel() {
    const provider = getLLMProvider();
    if (provider === "groq") return "Groq";
    if (provider === "openai") return "OpenAI";
    return "LLM";
}

function getLLMApiKey() {
    return process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";
}

function resolveLLMBaseURL() {
    if (process.env.OPENAI_BASE_URL) return process.env.OPENAI_BASE_URL;
    if (hasGroqKey()) return process.env.GROQ_BASE_URL || GROQ_BASE_URL;
    return undefined;
}

function isOpenAIOnlyModel(model) {
    return /^(gpt-|o[0-9]|chatgpt-)/i.test(model || "");
}

function resolveLLMModel(size = "small") {
    if (hasGroqKey()) {
        const groqModel =
            process.env.GROQ_MODEL ||
            (size === "large" ? process.env.GROQ_LARGE_MODEL : process.env.GROQ_SMALL_MODEL);

        if (groqModel) return groqModel;
        if (process.env.OPENAI_MODEL && !isOpenAIOnlyModel(process.env.OPENAI_MODEL)) {
            return process.env.OPENAI_MODEL;
        }
        return GROQ_DEFAULT_MODEL;
    }

    return process.env.OPENAI_MODEL || (size === "large" ? OPENAI_LARGE_MODEL : OPENAI_SMALL_MODEL);
}

function createLLMClient(OpenAI) {
    const apiKey = getLLMApiKey();
    if (!apiKey) return null;

    const config = { apiKey };
    const baseURL = resolveLLMBaseURL();
    if (baseURL) config.baseURL = baseURL;

    return new OpenAI(config);
}

module.exports = {
    createLLMClient,
    getLLMApiKey,
    getLLMProvider,
    getLLMProviderLabel,
    resolveLLMBaseURL,
    resolveLLMModel,
};
