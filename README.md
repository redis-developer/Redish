# 🤖 RediBuddy

**Short-term memory. Long-term friendship.**

RediBuddy is a lightweight, memory-backed AI assistant built using **Redis** and **OpenAI**. It mimics ChatGPT’s multi-chat interface with short-term memory using Redis as the memory store, letting users have quick, ephemeral conversations.

---

## 🧠 What it does

- Interactive chatbot interface
- Leverages Redis to provide super-fast conversational context to LLM.
- Conversations are tied to a unique session name and cleared at the end of the session.

---

## ⚙️ Tech Stack

- **Node.js** + **Express** (Backend API)
- **Redis** (Conversation store)
- **OpenAI API** (GPT-4o-mini)
- **HTML + CSS + Vanilla JS** (Frontend)

---

## 🚀 Getting Started

### 0. Prerequisites

#### ✅ Node.js (v18 or higher)

[Download & Install Node.js](https://nodejs.org/)

#### ✅ Redis

Install and run Redis. You can follow:

- [Redis installation guide](https://redis.io/docs/getting-started/installation/)

- Or use Docker:

```bash
  docker pull redis:8.0
  docker run --name redibuddy -p 6379:6379 redis:8.0
```

#### ✅ OpenAI API Key

Create an account and generate your API key from: https://platform.openai.com/account/api-keys

---

### 1. Clone the repo

```bash
git clone https://github.com/booleanhunter/redibuddy.git
cd redibuddy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file at the root:

```bash
OPENAI_API_KEY=your_openai_api_key
REDIS_URL=redis://localhost:6379
SERVER_PORT=3000
```

### 4. Start the server

```bash
npm start
```

## 🧪 Features

- 🔁 Multiple chats per user (like tabs)
- 🧠 Short-term memory support using Redis
- 🤖 Powered by GPT-4o-mini
- 🧩 Clean modular JS architecture

## 🐞 Reporting Issues

If you find a bug or have a feature request, open an issue.