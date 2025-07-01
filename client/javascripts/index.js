import {
    showTypingIndicator,
    removeTypingIndicator,
    appendMessage,
    updateChatPreviewWindow,
    addChatToSidebar,
    displayActiveChat,
} from './chatInterface.js';

import {
    chatData,
    sendChatMessage,
} from './chatService.js';

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('name') || 'anonymous';

document.getElementById('username-display').textContent = `Hello, ${sessionId}`;

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const newChatBtn = document.getElementById('new-chat');

// Generate new chat ID
function createChatId() {
  return 'chat_' + Date.now();
}

newChatBtn.addEventListener('click', () => {
    const chatId = createChatId();
    chatData.chats[chatId] = [];
    chatData.currentChatId = chatId;

    addChatToSidebar(chatId);
    displayActiveChat(chatId);
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = chatInput.value.trim();
    const chatId = chatData.currentChatId;

    if (!message || !chatId) {
        return;
    }

    chatData.addMessage(chatId, 'user', message);

    appendMessage('user', message);
    chatInput.value = '';

    // Send message
    await sendChatMessage(sessionId, chatId, message, {
        onLoad: () => {
            showTypingIndicator();
        },
        onSuccess: (reply) => {
            removeTypingIndicator();

            // chatData.addMessage(chatId, 'assistant', reply);
            appendMessage('bot', reply);

            // Update chat preview
            const previewText = chatData.getPreview(chatId);

            updateChatPreviewWindow(chatId, previewText);

        },
        onError: (err) => {
            console.error(err);
            removeTypingIndicator();
            appendMessage('bot', 'Oops! Something went wrong.');
        }
    });
});

document.getElementById('end-session').addEventListener('click', () => {
    window.location.href = '/';
});

// Auto-start with one chat
newChatBtn.click();
