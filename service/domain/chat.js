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
    const history = memoryEnabled ? await chatRepository.getOrCreateChatHistory(sessionId, chatId) : [];

    // Add new user message to history
    const userMessageData = {
        role: 'user',
        content: message,
    };

    history.push(userMessageData);

    // Call OpenAI Chat API
    const completion = await openaiClient.responses.create({
        model: "gpt-4o-mini",
        input: history,
    });

    const aiReplyMessage = completion.output_text;

    // Save messages for short-term memory
    if (memoryEnabled) {

        const chatMessageData = {
            role: 'assistant',
            content: aiReplyMessage,
        };

        await chatRepository.saveChatMessage(sessionId, chatId, userMessageData);
        await chatRepository.saveChatMessage(sessionId, chatId, chatMessageData);
    }

    return aiReplyMessage;
}

export async function endSession(sessionId) {
    const deletedSessionsCount = await chatRepository.deleteChats(sessionId);
    return {
        message: `Session ended successfully.`,
        deletedSessionsCount,
    };
}
