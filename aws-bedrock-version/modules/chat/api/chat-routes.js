import { Router } from 'express';
import { endUserSession, processShoppingInquiry } from '../domain/chat-service.js';
import { HttpStatusCode } from '#lib/errors.js';

const router = Router();

// POST /chat
router.post('/', async function(req, res, next) {
    const { message, sessionId, chatId, useSmartRecall } = req.body;

    if (!message || !sessionId) {
        return res.status(HttpStatusCode.BAD_REQUEST).json({ error: 'Missing message or sessionId' });
    }

    try {
        const reply = await processShoppingInquiry(sessionId, chatId, message, useSmartRecall);
        res.json({ 
            content: reply.content,
            isCachedResponse: reply.isCachedResponse
        });
    } catch (error) {
        next(error);
    }
});

router.post('/end-session', async function(req, res, next) {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(HttpStatusCode.BAD_REQUEST).json({ error: 'Missing sessionId' });
    }

    try {
        const result = await endUserSession(sessionId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
