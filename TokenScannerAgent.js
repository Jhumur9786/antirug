const { exec } = require("child_process");
const path = require("path");

/**
 * Node.js wrapper for the Solana Token Scanner Agent (Python).
 * Executes the python script and returns the parsed JSON result.
 */
class TokenScannerAgent {
    constructor() {
        this.pythonCmd = process.env.PYTHON_CMD || "python3";
        this.scriptPath = path.resolve(__dirname, "token_scanner_agent.py");
    }

    async scan(tokenId) {
        return new Promise((resolve, reject) => {
            if (!tokenId) {
                return reject(new Error("Invalid token ID"));
            }

            const command = `${this.pythonCmd} ${this.scriptPath} ${tokenId}`;
            
            exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error(`Failed to execute python scanner: ${error.message} \n ${stderr}`));
                }

                try {
                    // Python script might output logs before JSON.
                    // Find the last valid JSON block.
                    const outputStr = stdout.trim();
                    const lastBraceIndex = outputStr.lastIndexOf("}");
                    const firstBraceIndex = outputStr.substring(0, lastBraceIndex + 1).lastIndexOf("{");
                    
                    if (firstBraceIndex === -1 || lastBraceIndex === -1) {
                        return reject(new Error("Could not find JSON output from token scanner. Raw output: " + outputStr.substring(0, 200)));
                    }

                    const jsonStr = outputStr.substring(firstBraceIndex, lastBraceIndex + 1);
                    const data = JSON.parse(jsonStr);

                    if (data.error) {
                        return reject(new Error(`Solana RPC Error: ${data.error}`));
                    }
                    
                    resolve(data);
                } catch (parseError) {
                    reject(new Error(`Failed to parse output from token scanner: ${parseError.message}`));
                }
            });
        });
    }
}

module.exports = TokenScannerAgent;
