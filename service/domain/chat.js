import OpenAI from 'openai';
import ChatRepository from '../data/chat-repository.js';
import CONFIG from '../../config.js';

import { HumanMessage, AIMessage } from "@langchain/core/messages";


// import { graph, getExecutionSummary } from './langgraph.js';

import { graph, getExecutionSummary } from './ai-agent/index.js';

const openaiClient = new OpenAI({
    apiKey: CONFIG.openAiApiKey,
});

const chatRepository = new ChatRepository();

/** Retrieves a reply from the LLM based on the chat history and user message.
 *
 * @param {string} sessionId - The user's session identifier.
 * @param {string} chatId - The chat identifier.
 * @param {string} message
 * @param {boolean} useSmartRecall - Whether to enable short-term memory for the chat.
 */
export async function getReplyFromLLM(sessionId, chatId, message, useSmartRecall) {
    
    // Retrieve previous messages
    const history = await chatRepository.getOrCreateChatHistory(sessionId, chatId);

    // Add new user message to history
    const userMessageData = {
        role: 'user',
        content: message,
    };

    history.push(userMessageData);

    let queryResult = {};
    let queryResponseString = "";

    if (useSmartRecall && CONFIG.useLangCache) {
        const cachedResult = await chatRepository.findFromSemanticCache(sessionId, message);

        if (!cachedResult) {
            const completion = await openaiClient.responses.create({
                model: CONFIG.modelName,
                input: history,
            });

            queryResponseString = completion.output_text;

            queryResult = {
                isCachedResponse: false,
                content: queryResponseString
            };

            chatRepository.saveResponseInSemanticCache(sessionId, message, queryResponseString);
        } else {
            queryResponseString = cachedResult;
            queryResult = {
                isCachedResponse: true,
                content: queryResponseString,
            };
        }
    } else {
        const completion = await openaiClient.responses.create({
            model: CONFIG.modelName,
            input: history,
        });

        queryResponseString = completion.output_text;

        queryResult = {
            isCachedResponse: false,
            content: queryResponseString,
        };

        CONFIG.useLangCache && chatRepository.saveResponseInSemanticCache(sessionId, message, queryResponseString);
    }

    const chatMessageData = {
        role: 'assistant',
        content: queryResponseString,
    };

    await chatRepository.saveChatMessage(sessionId, chatId, userMessageData);
    await chatRepository.saveChatMessage(sessionId, chatId, chatMessageData);

    return queryResult;
}

export async function endSession(sessionId) {
    const deletedSessionsCount = await chatRepository.deleteChats(sessionId);
    const clearedCacheCount = CONFIG.useLangCache ? await chatRepository.clearSemanticCache(sessionId) : 0;

    return {
        message: `Session ended successfully.`,
        deletedSessionsCount,
        clearedCacheCount,
    };
}


/**
 * Retrieves a reply from the LangGraph LLM based on the chat history and user message.
 *
 * @param {string} sessionId - The user's session identifier.
 * @param {string} chatId - The chat identifier.
 * @param {string} message - The user's message.
 * @param {boolean} useSmartRecall - Whether to enable short-term memory for the chat.
 */
export async function getReplyFromAgent(sessionId, chatId, message, useSmartRecall) {
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

    // Create and run LangGraph
    const result = await graph.invoke({
        sessionId,
        messages,
    });

    // Get execution summary for demo/debugging
    const executionSummary = getExecutionSummary(result);

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