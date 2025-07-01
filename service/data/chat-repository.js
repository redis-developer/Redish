import { createClient } from 'redis';
import CONFIG from '../../config.js';

const client = await createClient({
    url: CONFIG.redisUrl,
}).on('error', (err) => console.log("Redis Client Error", err))
  .connect();

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
        const chatHistory = await client.json.get(sessionId, {
            path: `$.${chatId}`,
        });

        if (!chatHistory) { // if user session itself does not exist
            await client.json.set(sessionId, '$', {
                [chatId]: [],
            });
            return [];
        } else if (chatHistory.length === 0) { // if user session exists but chatId does not
            await client.json.set(sessionId, `$.${chatId}`, []);
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
        return client.json.arrAppend(`${sessionId}`, `$.${chatId}`, chatMessage);
    }

    /**
     * Delete session including all chat messages for a given sessionId
     * @param {string} sessionId
     */
    async deleteChats(sessionId) {
        return  client.json.del(sessionId);
    }

}
