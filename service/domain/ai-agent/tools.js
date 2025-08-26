import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { TavilySearch } from "@langchain/tavily";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import CONFIG from "../../../config.js";

/**
 * Tool: Web Search
 * 
 * Performs a real-time web search using Tavily's API to retrieve relevant and current information.
 * Suitable for queries requiring fresh data such as news, weather, or stock updates.
 *
 * @toolName web_search
 * @param {Object} input - The tool input.
 * @param {string} input.query - The search query string provided by the user.
 * @returns {Promise<string>} A brief summary or snippet from the most relevant search result.
 */
export const webSearchTool = tool(
    async ({ query }) => {
        console.log(`🔍 Using web search for: "${query}"`);
        const tavilySearch = new TavilySearch({
            maxResults: 3,
            topic: "general",
        });
        
        const result = await tavilySearch.invoke({ query });
        return extractSearchSummary(result);
    },
    {
        name: "web_search",
        description: "Search the web for current information, news, weather, stock prices, or any real-time data.",
        schema: z.object({
            query: z.string().describe("The search query")
        })
    }
);

/**
 * Tool: Direct Answer
 * 
 * Uses a language model (OpenAI via LangChain) to directly answer questions based on its trained knowledge.
 * Best for general-purpose knowledge, definitions, explanations, or factual answers that do not require live data.
 *
 * @toolName direct_answer
 * @param {Object} input - The tool input.
 * @param {string} input.question - The question the user wants answered.
 * @returns {Promise<string>} The language model's answer to the question.
 */
export const directAnswerTool = tool(
    async ({ question }) => {
        console.log(`💭 Using direct knowledge for: "${question}"`);
        const model = new ChatOpenAI({ 
            temperature: 0.1, 
            model: CONFIG.modelName, 
            apiKey: CONFIG.openAiApiKey 
        });
        
        const response = await model.invoke([
            new HumanMessage(`Answer this directly from your knowledge: ${question}`)
        ]);
        
        return response.content;
    },
    {
        name: "direct_answer",
        description: "Answer questions using your existing knowledge. This is for general knowledge questions, explanations, definitions, or any question that doesn't require real-time information.",
        schema: z.object({
            question: z.string().describe("The question to answer")
        })
    }
);

/**
 * Helper Function: extractSearchSummary
 * 
 * Extracts a concise and readable summary from the Tavily search response.
 * Prefers a direct answer if available, otherwise falls back to the top result's title and content.
 *
 * @param {Object|string} response - The response object from Tavily's search API or a raw string.
 * @returns {string} A summary of the top search result, or a fallback message.
 */
function extractSearchSummary(response) {
    if (!response) return "No response available.";

    if (typeof response.answer === "string" && response.answer.trim()) {
        return response.answer.trim();
    }

    const first = response.results?.[0];
    if (first) {
        const title = first.title || "";
        const content = first.content || "";
        return `${title}${title && content ? " - " : ""}${content}`.trim() || "Result found, but no content.";
    }

    if (typeof response === "string") {
        return response;
    }

    return "No relevant results found.";
}
