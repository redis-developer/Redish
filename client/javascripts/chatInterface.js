import {
    chatData,
} from './chatService.js';

const chatWindow = document.getElementById('chat-window');
const chatList = document.getElementById('chat-list');

export function displayActiveChat(chatId) {
    chatData.currentChatId = chatId;
    renderMessages(chatData.chats[chatId] || []);
    document.querySelectorAll('#chat-list li').forEach(li => {
        li.classList.toggle('active', li.dataset.id === chatId);
    });
}

export function renderMessages(messages) {
    chatWindow.innerHTML = '';
    messages.forEach(msg => appendMessage(msg.role, msg.content));
}

export function appendMessage(role, content) {
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    msg.innerText = content;
    chatWindow.appendChild(msg);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

export function addChatToSidebar(chatId, preview = 'New Chat') {
    const li = document.createElement('li');
    li.textContent = preview;
    li.dataset.id = chatId;

    li.addEventListener('click', () => displayActiveChat(chatId));
    chatList.appendChild(li);
}

export function showTypingIndicator() {
    const typingEl = document.createElement('div');
    typingEl.id = 'typing-indicator';
    typingEl.className = 'message bot';
    typingEl.innerText = 'Assistant is typing...';
    chatWindow.appendChild(typingEl);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

export function removeTypingIndicator() {
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl) {
        chatWindow.removeChild(typingEl);
    }
}

export function updateChatPreviewWindow(chatId, chatName) {
    const li = [...chatList.children].find(li => li.dataset.id === chatId);
    if (li) {
        li.textContent = chatName;
    }
}
