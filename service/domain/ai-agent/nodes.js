import { ChatOpenAI } from "@langchain/openai";
import { AIMessage } from "@langchain/core/messages";
import { webSearchTool, directAnswerTool } from "./tools.js";
import { getQueryPolicy } from "../cachePolicy.js";
import ChatRepository from "../../data/chat-repository.js";
import CONFIG from "../../../config.js";

const chatRepository = new ChatRepository();

/**
 * Check Cache
 * 
 * Looks for a cached response for the last user query in the session.
 * If a cached result exists and caching is enabled, it returns that response with cache metadata.
 * Otherwise, returns a "miss" to trigger further processing.
 * 
 * @async
 * @function checkCache
 * @param {Object} state - The current agent state including messages and session ID.
 * @param {Array} state.messages - The message history of the current session.
 * @param {string} state.sessionId - Unique session identifier for cache lookup.
 */
export const checkCache = async (state) => {
    const lastUserMessage = state.messages.findLast(m => m.getType() === "human");
    const query = lastUserMessage?.content || "";
    
    if (CONFIG.useLangCache) {
        const cachedResult = await chatRepository.findFromSemanticCache(state.sessionId, query);
        
        if (cachedResult) {
            console.log("🎯 Cache HIT - returning cached response");
            return {
                cacheStatus: "hit",
                result: cachedResult,
                messages: [...state.messages, new AIMessage(cachedResult)],
            };
        }
    }
    
    console.log("❌ Cache MISS - proceeding to agent");
    return {
        cacheStatus: "miss"
    };
};


/**
 * Agent with Auto Tools
 * 
 * Runs a LangChain-powered agent using the provided messages and automatically invokes tools 
 * (`web_search`, `direct_answer`) based on the agent's internal logic.
 * 
 * @async
 * @function agentWithAutoTools
 * @param {Object} state - The current agent state with message history and session info.
 * @param {Array} state.messages - The conversation history so far.
 */
export const agentWithAutoTools = async (state) => {
    const model = new ChatOpenAI({ 
        temperature: 0.1, 
        model: CONFIG.modelName, 
        apiKey: CONFIG.openAiApiKey 
    });

    const modelWithTools = model.bindTools([webSearchTool, directAnswerTool]);

    try {
        let currentMessages = [...state.messages];
        let toolUsed = "none";
        
        while (true) {
            const response = await modelWithTools.invoke(currentMessages);
            currentMessages.push(response);

            if (!response.tool_calls || response.tool_calls.length === 0) {
                console.log("🤖 Agent provided direct response (no tools)");
                return {
                    result: response.content,
                    messages: [...state.messages, new AIMessage(response.content)],
                    toolUsed,
                };
            }

            for (const toolCall of response.tool_calls) {
                let toolResult;
                
                console.log(`🤖 Agent chose tool: ${toolCall.name}`);
                toolUsed = toolCall.name;

                if (toolCall.name === "web_search") {
                    toolResult = await webSearchTool.invoke(toolCall.args);
                } else if (toolCall.name === "direct_answer") {
                    toolResult = await directAnswerTool.invoke(toolCall.args);
                } else {
                    toolResult = "Unknown tool";
                }

                currentMessages.push({
                    role: "tool",
                    content: toolResult,
                    tool_call_id: toolCall.id,
                });
            }
        }
    } catch (error) {
        console.error("❌ Agent error:", error);
        return {
            result: "I apologize, but I'm having trouble processing your request.",
            messages: [...state.messages, new AIMessage("I apologize, but I'm having trouble processing your request.")],
            toolUsed: "error",
        };
    }
};

/**
 * Save to Cache
 * 
 * Persists the final response from the agent into the cache for future retrieval based on 
 * the session ID and query content. Uses TTL defined by the query policy.
 * 
 * This function is a no-op if caching is disabled or the result is not present.
 * 
 * @async
 * @function saveToCache
 * @param {Object} state - The final agent state including the result and messages.
 * @param {Array} state.messages - The complete conversation history.
 * @param {string} state.sessionId - Unique session ID for cache storage.
 * @param {string} [state.result] - The final output to be cached.
 */
export const saveToCache = async (state) => {
    if (!CONFIG.useLangCache || !state.result) {
        return {};
    }
    
    const lastUserMessage = state.messages.find(m => m.getType() === "human");
    const query = lastUserMessage?.content || "";
    
    const policy = getQueryPolicy(query);
    const ttl = policy.cacheTTLMillis;
    
    await chatRepository.saveResponseInSemanticCache(
        state.sessionId, 
        query, 
        state.result, 
        ttl
    );
    
    console.log(`💾 Saved to cache with TTL: ${ttl}ms`);
    return {};
};
