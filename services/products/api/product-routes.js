// services/products/api/product-routes.js
import { Router } from 'express';
import { getProductById } from '../domain/product-service.js';

const router = Router();

// Get product details for product page
router.get('/:productId', async function(req, res, next) {
    const { productId } = req.params;

    try {
        const product = await getProductById(productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            product: product
        });
    } catch (error) {
        console.error('Error getting product:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get product details' 
        });
    }
});

export default router;