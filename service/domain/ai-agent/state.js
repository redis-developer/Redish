import { z } from "zod";
import { MessagesZodState } from "@langchain/langgraph";

/**
 * AgentState Schema
 *
 * Extends the base `MessagesZodState` with additional metadata fields for tracking
 * agent session context, caching, and tool invocation details.
 *
 * This schema is used to persist and validate the evolving state of a LangGraph agent.
 *
 * @typedef {Object} AgentState
 * @property {string} sessionId - Unique session ID for tracking the agent's lifecycle.
 * @property {string} [result] - Optional result string, typically representing output or final response.
 * @property {"hit" | "miss"} [cacheStatus] - Optional cache indicator showing if a cached result was used.
 * @property {string} [toolUsed] - Optional name or key of the tool invoked by the agent during processing.
 */
export const AgentState = MessagesZodState.extend({
    sessionId: z.string(),
    result: z.string().optional(),
    cacheStatus: z.enum(["hit", "miss"]).optional(),
    toolUsed: z.string().optional(),
});
