import { Router } from 'express';
import { getReplyFromLLM } from '../../domain/chat.js';

const router = Router();

/* GET home page. */
// POST /chat
router.post('/chat', async function(req, res, next) {
	const { message, sessionId, chatId } = req.body;

	if (!message || !sessionId) {
		return res.status(400).json({ error: 'Missing message or sessionId' });
	}

	try {
		const reply = await getReplyFromLLM(sessionId, chatId, message);
		res.json({ reply });
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: 'Something went wrong.' });
	}
});

export default router;
