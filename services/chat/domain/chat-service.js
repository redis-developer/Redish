// services/chat/domain/chat-service.js
import ChatRepository from '../data/chat-repository.js';
import { getGroceryShoppingReply } from '../../ai/grocery-ai-agent/index.js';

const chatRepository = new ChatRepository();

/**
 * Save response to semantic cache
 * @param {string} sessionId - User session ID
 * @param {string} query - Original user query
 * @param {string} response - Response to cache
 * @param {number} ttlMillis - Time to live in milliseconds
 * @returns {Promise<Object>} Cache save result
 */
export async function saveToSemanticCache(sessionId, query, response, ttlMillis) {
    try {
        await chatRepository.saveResponseInSemanticCache(
            query,
            response,
            ttlMillis,
            sessionId
        );
        
        const ttlDays = Math.round(ttlMillis / (24 * 60 * 60 * 1000));
        
        return {
            success: true,
            ttlDays: ttlDays,
            message: "Response cached successfully for future queries."
        };
    } catch (error) {
        console.error('Error saving to semantic cache:', error);
        throw error;
    }
}

/**
 * Check semantic cache for similar queries
 * @param {string} sessionId - User session ID
 * @param {string} query - User query to check
 * @returns {Promise<Object|null>} Cached response or null
 */
export async function checkSemanticCache(sessionId, query) {
    try {
        return await chatRepository.findFromSemanticCache(sessionId, query);
    } catch (error) {
        console.error('Error checking semantic cache:', error);
        throw error;
    }
}

/**
 * End user session and clear chat data
 * @param {string} sessionId - User session ID
 * @returns {Promise<Object>} Session end result
 */
export async function endUserSession(sessionId) {
    try {
        return await chatRepository.deleteChats(sessionId);
    } catch (error) {
        console.error('Error ending user session:', error);
        throw error;
    }
}

/**
 * Get reply from grocery AI agent
 * @param {string} sessionId - User session ID
 * @param {string} chatId - Chat ID
 * @param {string} message - User message
 * @param {boolean} useSmartRecall - Whether to use smart recall caching
 * @returns {Promise<Object>} AI agent reply
 */
export async function getReplyFromGroceryAgent(sessionId, chatId, message, useSmartRecall) {
    try {
        return await getGroceryShoppingReply(sessionId, chatId, message, useSmartRecall);
    } catch (error) {
        console.error('Error getting reply from grocery agent:', error);
        throw error;
    }
}