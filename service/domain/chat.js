import OpenAI from 'openai';
import ChatRepository from '../data/chat-repository.js';
import CONFIG from '../../config.js';

const openaiClient = new OpenAI({
    apiKey: CONFIG.openAiApiKey,
});

const chatRepository = new ChatRepository();

export async function getReplyFromLLM(sessionId, chatId, message) {
    
    // Retrieve previous messages
    const history = await chatRepository.getOrCreateChatHistory(sessionId, chatId);

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
    const chatMessageData = {
        role: 'assistant',
        content: aiReplyMessage,
    }

    await chatRepository.saveChatMessage(sessionId, chatId, userMessageData);
    await chatRepository.saveChatMessage(sessionId, chatId, chatMessageData);

    return aiReplyMessage;
}

export async function endSession(sessionId) {
    const deletedSessionsCount = await chatRepository.deleteChats(sessionId);
    return {
        message: `Session ended successfully.`,
        deletedSessionsCount,
    };
}
