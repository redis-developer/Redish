import * as fs from "node:fs/promises";

import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./state.js";
import { checkCache, agentWithAutoTools, saveToCache } from "./nodes.js";

export const createLangGraphAgent = () => {
    const graph = new StateGraph(AgentState)
        .addNode("check_cache", checkCache)
        .addNode("agent_with_auto_tools", agentWithAutoTools)
        .addNode("save_to_cache", saveToCache)
        
        .addEdge(START, "check_cache")
        .addConditionalEdges("check_cache", (state) => {
            return state.cacheStatus === "hit" ? END : "agent_with_auto_tools";
        })
        .addEdge("agent_with_auto_tools", "save_to_cache")
        .addEdge("save_to_cache", END)
        
        .compile();
    
    return graph;
};

export const graph = createLangGraphAgent();

export function getExecutionSummary(graphResult) {
    const summary = {
        toolUsed: graphResult.toolUsed || "none",
        cacheStatus: graphResult.cacheStatus || "miss",
        finalResult: graphResult.result,
    };
    
    console.log("\n📊 EXECUTION SUMMARY:");
    console.log(`Cache: ${summary.cacheStatus === "hit" ? "🎯 HIT" : "❌ MISS"}`);
    console.log(`Tool Used: ${summary.toolUsed === "none" ? "🧠 Direct Response" : `🔧 ${summary.toolUsed}`}`);
    console.log("─".repeat(50));
    
    return summary;
}

async function visualizeGraph() {
    const drawableGraph = await graph.getGraphAsync();
    const image = await drawableGraph.drawMermaidPng();
    const imageBuffer = new Uint8Array(await image.arrayBuffer());

    await fs.writeFile("ai-agent-graph.png", imageBuffer);
}

visualizeGraph();