import { Router } from 'express';
import { getReplyFromLLM, getReplyFromAgent, endSession } from '../../domain/chat.js';

const router = Router();

/* GET home page. */
// POST /chat
router.post('/chat', async function(req, res, next) {
	const { message, sessionId, chatId, useSmartRecall } = req.body;

	if (!message || !sessionId) {
		return res.status(400).json({ error: 'Missing message or sessionId' });
	}

	try {
		const reply = await getReplyFromAgent(sessionId, chatId, message, useSmartRecall);
		res.json({ 
			content: reply.content,
			isCachedResponse: reply.isCachedResponse
		});
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: 'Something went wrong.' });
	}
});

router.post('/chat/end-session', async function(req, res, next) {
	const { sessionId } = req.body;

	if (!sessionId) {
		return res.status(400).json({ error: 'Missing sessionId' });
	}

	try {
		const result = await endSession(sessionId);
		res.json(result);
	} catch (error) {
		console.log(error.stack);
		res.status(500).json({ error: 'Something went wrong.' });
	}
});

export default router;
