import {
    showTypingIndicator,
    removeTypingIndicator,
    displayMessage,
    updateChatPreviewWindow,
    addChatToSidebar,
    displayActiveChat,
} from './chatInterface.js';

import {
    chatData,
    sendChatMessage,
    endSession,
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

    chatData.addMessage(chatId, { role: 'user', content: message });

    displayMessage('user', message);
    chatInput.value = '';

    const includeMemory = document.getElementById('memory-toggle')?.checked || false;

    // Send message
    await sendChatMessage(sessionId, chatId, message, {
        onLoad: () => {
            showTypingIndicator();
        },
        onSuccess: (chatReplyObject) => {
            removeTypingIndicator();

            displayMessage(
                'assistant',
                chatReplyObject.content,
                chatReplyObject.isCachedResponse,
                chatReplyObject.responseTime,
            );

            // Update chat preview
            const previewText = chatData.getPreview(chatId);

            updateChatPreviewWindow(chatId, previewText);

        },
        onError: (err) => {
            console.error(err);
            removeTypingIndicator();
            displayMessage('assistant-error', 'Oops! Something went wrong.');
        },
        useSmartRecall: includeMemory,
    });
});

document.getElementById('end-session').addEventListener('click', () => {
    endSession(sessionId, {
        onLoad: () => {
            console.log('Ending session...');
        },
        onSuccess: (data) => {
            // Navigate away on success
            console.log(data);
            window.location.href = '/';
        },
        onError: (err) => {
            alert('Could not end session: ' + err.message);
        }
    });
});



// Auto-start with one chat
newChatBtn.click();
