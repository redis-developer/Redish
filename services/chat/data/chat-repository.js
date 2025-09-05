import { createClient } from 'redis';
import { LangCache } from "@redis-ai/langcache";

import CONFIG from '../../../config.js';

const client = await createClient({
    url: CONFIG.redisUrl,
}).on('error', (err) => console.log('Redis Client Error', err))
  .connect();

// LangCache is always available
const langCache = new LangCache({
    serverURL: CONFIG.langcacheApiBaseUrl,
    cacheId: CONFIG.langcacheCacheId,
    apiKey: CONFIG.langcacheApiKey,
});

/**
 * @typedef {Object} ChatMessage
 * @property {'user' | 'assistant'} role
 * @property {string} content
 */

export default class ChatRepository {

    /**
     * Retrieve chat history from Redis
     * @param {string} sessionId
     * @param {string} chatId
     * @returns {Promise<ChatMessage[]>}
     */
    async getOrCreateChatHistory(sessionId, chatId) {
        const userKey = `users:${sessionId}`;
        const chatHistory = await client.json.get(userKey, {
            path: `$.chat.${chatId}`,
        });

        if (!chatHistory) { // if user session itself does not exist
            await client.json.set(userKey, '$', {
                sessionId: sessionId,
                chat: {
                    [chatId]: [],
                },
                cart: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return [];
        } else if (chatHistory.length === 0) { // if user session exists but chatId does not
            await client.json.set(userKey, `$.chat.${chatId}`, []);
            return [];
        } else {
            return chatHistory[0];
        }
    }

    /**
     * Save chat history to Redis
     * @param {string} sessionId
     * @param {string} chatId
     * @param {ChatMessage} chatMessage
     */
    async saveChatMessage(sessionId, chatId, chatMessage) {
        const userKey = `users:${sessionId}`;
        await client.json.set(userKey, '$.updatedAt', new Date().toISOString());
        return client.json.arrAppend(userKey, `$.chat.${chatId}`, chatMessage);
    }

    /**
     * Delete session including all chat messages for a given sessionId
     * @param {string} sessionId
     */
    async deleteChats(sessionId) {
        const userKey = `users:${sessionId}`;
        return client.json.del(userKey);
    }

    /**
     * Search user query in langcache
     * @param {string} sessionId
     * @param {string} query
     * @returns {Promise<string|null>}
     */
    async findFromSemanticCache(sessionId, query) {
        const result = await langCache.search({
            prompt: query,
            similarityThreshold: 0.9,
            attributes: {
                "sessionId": sessionId,
            }
        });

        return result.data?.[0]?.response || null;
    }

    /**
     * Save results in Redis Langcache.
     * @async
     * @param {string} sessionId - Unique identifier for the user session.
     * @param {string} query - The original user query to store as the semantic prompt.
     * @param {string} aiReplyMessage - The AI-generated response to be cached.
     * @param {number} ttlMillis - Time-to-live in milliseconds for the cached entry.
     */
    async saveResponseInSemanticCache(query, aiReplyMessage, ttlMillis, sessionId) {
        const result = await langCache.set({
            prompt: query,
            response: aiReplyMessage,
            attributes: {
                "sessionId": sessionId
            },
            ttlMillis,
        });
    
        return result;
    }

    /**
     * Clear all semantic cache entries associated with a session.
     * 
     * @async
     * @param {string} sessionId - The session identifier used to scope cache entries.
     */
    async clearSemanticCache(sessionId) {
        const result = await langCache.deleteQuery({
            attributes: {
                "sessionId": sessionId
            }
        });
    
        return result.deletedEntriesCount;
    }
    
}
