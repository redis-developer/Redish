export let CURRENT_CHAT_ID = null;
export let CHATS = {}; // In-memory store of chatId → messages

export const chatData = {
    get currentChatId() {
        return CURRENT_CHAT_ID;
    },
    set currentChatId(id) {
        CURRENT_CHAT_ID = id;
    },
    get chats() {
        return CHATS;
    },
    set chats(newChats) {
        CHATS = newChats;
    },
    /**
     * Adds a message to the chat by chatId.
     * @param {string} chatId 
     * @param {'user' | 'assistant'} role 
     * @param {string} content 
     */
    addMessage(chatId, role, content) {
        CHATS[chatId] = CHATS[chatId] || [];
        CHATS[chatId].push({ role, content });
    },

    /**
     * Returns the preview text of the first message in a chat.
     * @param {string} chatId 
     * @param {number} length 
     * @returns {string}
     */
    getPreview(chatId, length = 25) {
        const firstMessage = CHATS[chatId]?.[0]?.content || '';
        return firstMessage.length > 0 ? firstMessage.slice(0, length) + '...' : '';
    }
};

/**
 * Sends a chat message to the server.
 * 
 * @param {string} sessionId 
 * @param {string} chatId 
 * @param {string} message 
 * @param {Object} [options]
 * @param {() => void} [options.onLoad]                 - called before fetch
 * @param {(reply: string) => void} [options.onSuccess] - called with assistant reply
 * @param {(error: any) => void} [options.onError]      - called on fetch or server error
 */
export async function sendChatMessage(sessionId, chatId, message, options = {}) {
    const { onLoad, onSuccess, onError } = options;

    try {
        onLoad?.();
        const res = await fetch('/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId,
                sessionId,
                message,
            })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Unknown error');
        }

        const data = await res.json();
        const reply = data.reply;
        chatData.addMessage(chatId, 'assistant', reply);
        
        onSuccess?.(reply);

    } catch (error) {
        onError?.(error);
    }
}

