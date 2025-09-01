// services/cart/domain/cart-service.js
import CartRepository from '../data/cart-repository.js';

const cartRepository = new CartRepository();

/**
 * Add multiple items to cart
 * @param {string} sessionId - User session ID
 * @param {Array<string>} productIds - Array of product IDs
 * @param {Array<number>} quantities - Array of quantities
 * @returns {Promise<Object>} Cart operation result
 */
export async function addItemsToCart(sessionId, productIds, quantities) {
    try {
        const addedItems = [];
        let totalAdded = 0;
        
        for (let i = 0; i < productIds.length; i++) {
            const productId = productIds[i];
            const quantity = quantities[i] || 1;
            
            const result = await cartRepository.addToCart(sessionId, productId, quantity);
            
            if (result.success) {
                addedItems.push(result.addedItem);
                totalAdded++;
            }
        }
        
        if (totalAdded === 0) {
            return {
                success: false,
                error: "Could not add any items to cart. Please check product IDs."
            };
        }
        
        const cart = await cartRepository.getCart(sessionId);
        
        return {
            success: true,
            addedItems: addedItems,
            totalAdded: totalAdded,
            cartSummary: cart.summary,
            message: `Successfully added ${totalAdded} item(s) to your cart!`
        };
    } catch (error) {
        console.error('Error adding items to cart:', error);
        throw error;
    }
}

/**
 * Add single item to cart
 * @param {string} sessionId - User session ID
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to add
 * @returns {Promise<Object>} Cart operation result
 */
export async function addItemToCart(sessionId, productId, quantity = 1) {
    try {
        return await cartRepository.addToCart(sessionId, productId, quantity);
    } catch (error) {
        console.error('Error adding item to cart:', error);
        throw error;
    }
}

/**
 * Get cart contents
 * @param {string} sessionId - User session ID
 * @returns {Promise<Object>} Cart contents
 */
export async function getCart(sessionId) {
    try {
        return await cartRepository.getCart(sessionId);
    } catch (error) {
        console.error('Error getting cart:', error);
        throw error;
    }
}

/**
 * Remove item from cart
 * @param {string} sessionId - User session ID
 * @param {string} productId - Product ID to remove
 * @returns {Promise<Object>} Cart operation result
 */
export async function removeItemFromCart(sessionId, productId) {
    try {
        return await cartRepository.removeFromCart(sessionId, productId);
    } catch (error) {
        console.error('Error removing item from cart:', error);
        throw error;
    }
}

/**
 * Clear entire cart
 * @param {string} sessionId - User session ID
 * @returns {Promise<Object>} Cart operation result
 */
export async function clearCart(sessionId) {
    try {
        return await cartRepository.clearCart(sessionId);
    } catch (error) {
        console.error('Error clearing cart:', error);
        throw error;
    }
}