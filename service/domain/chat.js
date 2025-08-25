import OpenAI from 'openai';
import ChatRepository from '../data/chat-repository.js';
import CONFIG from '../../config.js';

const openaiClient = new OpenAI({
    apiKey: CONFIG.openAiApiKey,
});

const chatRepository = new ChatRepository();

/** Retrieves a reply from the LLM based on the chat history and user message.
 *
 * @param {string} sessionId - The user's session identifier.
 * @param {string} chatId - The chat identifier.
 * @param {string} message
 * @param {boolean} memoryEnabled - Whether to enable short-term memory for the chat.
 */
export async function getReplyFromLLM(sessionId, chatId, message, memoryEnabled) {
    
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

    if (memoryEnabled && CONFIG.useLangCache) {
        const cachedResult = await chatRepository.searchUserQueryInCache(sessionId, message);

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

            chatRepository.saveLLMResponseInCache(sessionId, message, queryResponseString);
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

        CONFIG.useLangCache && chatRepository.saveLLMResponseInCache(sessionId, message, queryResponseString);
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
    const clearedCacheCount = CONFIG.useLangCache ? await chatRepository.clearUserCache(sessionId) : 0;

    return {
        message: `Session ended successfully.`,
        deletedSessionsCount,
        clearedCacheCount,
    };
}
