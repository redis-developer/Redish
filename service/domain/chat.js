import OpenAI from 'openai';
import CONFIG from '../../config.js';

const openaiClient = new OpenAI({
    apiKey: CONFIG.openAiApiKey,
});

export async function getReplyFromLLM(sessionId, chatId, message) {
    const userMessageData = {
        role: 'user',
        content: message,
    };

    // Call OpenAI Chat API
    const completion = await openaiClient.responses.create({
        model: "gpt-4o-mini",
        input: [userMessageData],
    });

    const aiReplyMessage = completion.output_text;

    return aiReplyMessage;
}
