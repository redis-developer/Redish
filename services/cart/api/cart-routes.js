// services/cart/api/cart-routes.js
import { Router } from 'express';
import { addItemToCart, getCart, removeItemFromCart, clearCart } from '../domain/cart-service.js';
import { getProductById } from '../../products/domain/product-service.js';

const router = Router();

// Add product to cart
router.post('/add', async function(req, res, next) {
    const { sessionId, productId, quantity = 1 } = req.body;

    if (!sessionId || !productId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing sessionId or productId' 
        });
    }

    try {
        const result = await addItemToCart(sessionId, productId, quantity);
        res.json(result);
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to add item to cart' 
        });
    }
});

// Get cart contents
router.get('/:sessionId', async function(req, res, next) {
    const { sessionId } = req.params;

    if (!sessionId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing sessionId' 
        });
    }

    try {
        const cart = await getCart(sessionId);
        res.json(cart);
    } catch (error) {
        console.error('Error getting cart:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get cart contents' 
        });
    }
});

// Remove item from cart
router.delete('/:sessionId/:productId', async function(req, res, next) {
    const { sessionId, productId } = req.params;

    try {
        const result = await removeItemFromCart(sessionId, productId);
        res.json(result);
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to remove item from cart' 
        });
    }
});

// Clear entire cart
router.delete('/:sessionId', async function(req, res, next) {
    const { sessionId } = req.params;

    try {
        const result = await clearCart(sessionId);
        res.json(result);
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to clear cart' 
        });
    }
});

export default router;