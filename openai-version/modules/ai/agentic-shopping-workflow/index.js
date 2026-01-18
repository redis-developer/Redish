import * as fs from "node:fs/promises";

import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { ShoppingAgentState } from "./state.js";
import { queryCacheCheck, personalShopperAgent, processWorkOutputWithCaching } from "./nodes.js";

import ChatRepository from "../../chat/data/chat-repository.js";

const chatRepository = new ChatRepository();

/**
 * Create Agentic AI Shopping Workflow
 *
 * This creates a multi-agent workflow system for intelligent shopping assistance with:
 * 1. Smart caching for recipe ingredient lists (long TTL) vs cart/search operations (no cache)
 * 2. Specialized shopping tools with embeddings support
 * 3. Product ID-based cart management
 * 4. LLM-powered recipe ingredient knowledge + real product database
 */
export const createAgenticAIShoppingWorkflow = () => {
    const graph = new StateGraph(ShoppingAgentState)
        .addNode("query_cache_check", queryCacheCheck)
        .addNode("personal_shopper_agent", personalShopperAgent)
        .addNode("process_work_output_with_caching", processWorkOutputWithCaching)

        .addEdge(START, "query_cache_check")
        .addConditionalEdges("query_cache_check", (state) => {
            return state.cacheStatus === "hit" ? END : "personal_shopper_agent";
        })
        .addEdge("personal_shopper_agent", "process_work_output_with_caching")
        .addEdge("process_work_output_with_caching", END)

        .compile();

    visualizeGraph(graph);
    
    return graph;
};

export const shoppingWorkflowGraph = createAgenticAIShoppingWorkflow();

export function getWorkflowExecutionSummary(graphResult) {
    const toolNames = (graphResult.toolResults || []).map(tr => tr.toolName);

    const summary = {
        toolsUsed: toolNames.length > 0 ? toolNames : ["none"],
        cacheStatus: graphResult.cacheStatus || "miss",
        finalResult: graphResult.result,
        sessionId: graphResult.sessionId,
        productsFound: graphResult.foundProducts?.length || 0
    };

    console.log("\n🛒 GROCERY SHOPPING EXECUTION SUMMARY:");
    console.log(`Session: ${summary.sessionId}`);
    console.log(`Cache: ${summary.cacheStatus === "hit" ? "🎯 HIT" : "❌ MISS"}`);

    // Display all tools used
    if (summary.toolsUsed.length === 1 && summary.toolsUsed[0] === "none") {
        console.log(`Tools Used: 🧠 Direct Response (no tools)`);
    } else {
        const toolIcons = summary.toolsUsed.map(tool => {
            switch(tool) {
                case "direct_answer": return "🧠 Direct Knowledge";
                case "search_products": return "🔍 Product Search";
                case "add_to_cart": return "🛒 Add to Cart";
                case "view_cart": return "👀 View Cart";
                case "clear_cart": return "🗑️ Clear Cart";
                case "fast_recipe_ingredients": return "🍳 Recipe Ingredients";
                case "save_to_semantic_cache": return "💾 Save Cache";
                case "error": return "❌ Error";
                default: return `🔧 ${tool}`;
            }
        });
        console.log(`Tools Used: ${toolIcons.join(" → ")}`);
        console.log(`Tool Count: ${summary.toolsUsed.length}`);
    }

    if (summary.productsFound > 0) {
        console.log(`Products Found: ${summary.productsFound}`);
    }
    console.log("─".repeat(50));

    return summary;
}

/**
 * Main function to execute the shopping workflow
 */
export async function runShoppingAgentWorkflow(sessionId, chatId, message, useSmartRecall) {
    const rawHistory = await chatRepository.getOrCreateChatHistory(sessionId, chatId);

    // Convert raw history to LangChain message format
    const messages = rawHistory.map((msg) => {
        return msg.role === "user"
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content);
    });

    // Add the new user message
    const userMessage = new HumanMessage(message);
    messages.push(userMessage);

    // Run the shopping workflow graph
    const result = await shoppingWorkflowGraph.invoke({
        sessionId,
        messages,
    });

    // Get execution summary for logging
    const executionSummary = getWorkflowExecutionSummary(result);

    const finalReply = result.result || result.output;

    const queryResult = {
        isCachedResponse: result.cacheStatus === "hit",
        content: finalReply,
    };

    // Save messages back to storage
    await chatRepository.saveChatMessage(sessionId, chatId, {
        role: "user",
        content: message,
    });

    await chatRepository.saveChatMessage(sessionId, chatId, {
        role: "assistant",
        content: finalReply,
    });

    return queryResult;
}

async function visualizeGraph(graph) {
    const drawableGraph = await graph.getGraphAsync();
    const image = await drawableGraph.drawMermaidPng();
    const imageBuffer = new Uint8Array(await image.arrayBuffer());

    await fs.writeFile("docs/technical-diagrams/ai-agent-graph.png", imageBuffer);
}
