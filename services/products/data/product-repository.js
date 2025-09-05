import { createClient } from 'redis';
import { LangCache } from "@redis-ai/langcache";

import CONFIG from '../../../config.js';
import { generateEmbeddings } from '../domain/helpers.js';

const client = await createClient({
    url: CONFIG.redisUrl,
}).on('error', (err) => console.log('Redis Client Error', err))
  .connect();

// LangCache is always available
const langCache = new LangCache({
    serverURL: CONFIG.langcacheApiBaseUrl,
    cacheId: CONFIG.langcacheCacheId,
    apiKey: CONFIG.langcacheApiKey,
});

export default class ProductRepository {

    /**
     * Semantic search using Redis Vector Search
     * @param {string} query - Natural language search query
     * @param {number} limit - Number of results to return
     * @param {number} threshold - Similarity threshold (0-1, default: 0.7)
     */
    async semanticSearchProducts(query, limit = 10, threshold = 0.5) {
        try {
            // Generate embedding for the search query
            const queryEmbeddings = await generateEmbeddings([query]);
            const searchVector = queryEmbeddings[0];
            
            // Convert embedding to bytes for Redis
            const vectorBytes = Buffer.from(new Float32Array(searchVector).buffer);
            
            // Use Redis Vector Search with FT.SEARCH
            const searchQuery = `*=>[KNN ${limit} @embedding $vector AS score]`;
            
            // OPTIMIZATION: Return more fields to avoid separate JSON.GET calls
            const results = await client.ft.search('idx:products', searchQuery, {
                PARAMS: {
                    vector: vectorBytes
                },
                RETURN: ['id', 'name', 'brand', 'category', 'price', 'salePrice', 'marketPrice', 'rating', 'score', 'isOnSale'],
                DIALECT: 2,
                LIMIT: { from: 0, size: limit }
            });
            
            const products = [];
            for (const doc of results.documents) {
                const similarity = 1 - parseFloat(doc.value.score);
                const productId = doc.id.replace('products:', '');
                products.push({
                    id: productId,
                    name: doc.value.name,
                    brand: doc.value.brand || 'Generic',
                    category: doc.value.category,
                    salePrice: parseFloat(doc.value.salePrice) || 0,
                    marketPrice: parseFloat(doc.value.marketPrice) || 0,
                    isOnSale: doc.value.isOnSale,
                    rating: parseFloat(doc.value.rating) || 0,
                    semanticScore: similarity
                });
            }
            console.log(`Found ${products.length} products`);
            return products;
            
        } catch (error) {
            console.error('❌ Error in semantic search:', error);
            return [];
        }
    }

    /**
     * Enhanced product search that combines keyword and semantic search
     * @param {Object} criteria - Search criteria
     */
    async searchProducts(criteria = {}) {
        const { query, category, maxPrice, minRating, limit = 10, useSemanticSearch = true } = criteria;
        
        try {
            let products = [];
            
            // Try semantic search first if query provided
            if (query && useSemanticSearch) {
                console.log('🧠 Using semantic search...');
                products = await this.semanticSearchProducts(query, limit * 2, 0.6); // Lower threshold, get more results
            }
            
            // Fallback to keyword search if semantic search returns few results
            if (products.length < 3 && query) {
                console.log('🔍 Supplementing with keyword search...');
                const keywordResults = await this.keywordSearchProducts({ query, category, maxPrice, minRating, limit });
                
                // Merge results, avoiding duplicates
                keywordResults.forEach(product => {
                    if (!products.find(p => p.id === product.id)) {
                        products.push(product);
                    }
                });
            }
            
            // Category filter
            if (category) {
                products = products.filter(p => 
                    p.category.toLowerCase().includes(category.toLowerCase())
                );
            }
            
            // Price filter
            if (maxPrice) {
                products = products.filter(p => p.salePrice <= maxPrice);
            }
            
            // Rating filter
            if (minRating) {
                products = products.filter(p => (p.rating || 0) >= minRating);
            }
            
            // Sort by relevance (semantic score or rating)
            products.sort((a, b) => {
                if (a.semanticScore && b.semanticScore) {
                    return b.semanticScore - a.semanticScore;
                }
                return (b.rating || 0) - (a.rating || 0);
            });
            
            return products.slice(0, limit);
            
        } catch (error) {
            console.error('❌ Error in enhanced product search:', error);
            // Fallback to basic keyword search
            return await this.keywordSearchProducts(criteria);
        }
    }

    /**
     * Traditional keyword-based product search using Redis FT.SEARCH
     */
    async keywordSearchProducts(criteria = {}) {
        const { query, category, maxPrice, minRating, limit = 20 } = criteria;
        
        try {
            let searchQuery = '*';
            const filters = [];
            
            // Build search query
            if (query) {
                const searchTerms = query.toLowerCase().split(/\s+/).join(' | ');
                searchQuery = `@name:(${searchTerms}) | @description:(${searchTerms})`;
            }
            
            // Add filters
            if (category) {
                filters.push(`@category:{${category}}`);
            }
            
            if (maxPrice) {
                filters.push(`@price:[0 ${maxPrice}]`);
            }
            
            if (minRating) {
                filters.push(`@rating:[${minRating} +inf]`);
            }
            
            // Combine query and filters
            if (filters.length > 0) {
                searchQuery = filters.length > 0 ? `(${searchQuery}) ${filters.join(' ')}` : searchQuery;
            }
            
            const results = await client.ft.search('idx:products', searchQuery, {
                LIMIT: { from: 0, size: limit },
                SORTBY: 'rating',
                DIALECT: 2
            });
            
            // Fetch full product details
            const products = [];
            for (const doc of results.documents) {
                try {
                    const product = await client.json.get(doc.id, { path: '$' });
                    if (product && product[0]) {
                        products.push(product[0]);
                    }
                } catch (err) {
                    continue;
                }
            }
            
            return products;
            
        } catch (error) {
            console.error('❌ Error in keyword search:', error);
            
            // Fallback to simple random sample
            try {
                const sampleKeys = await client.keys('products:*');
                const randomSample = sampleKeys.sort(() => 0.5 - Math.random()).slice(0, limit);
                
                const products = [];
                for (const key of randomSample) {
                    try {
                        const product = await client.json.get(key, { path: '$' });
                        if (product && product[0]) {
                            products.push(product[0]);
                        }
                    } catch (err) {
                        continue;
                    }
                }
                
                return products;
            } catch (fallbackError) {
                console.error('❌ Fallback search also failed:', fallbackError);
                return [];
            }
        }
    }

    /**
     * Get product by ID
     * @param {string} productId - The product ID
     * @returns {Promise<Object|null>} Product object or null if not found
     */
    async getProductById(productId) {
        try {
            const product = await client.json.get(`products:${productId}`, { path: '$' });
            return product ? product[0] : null;
        } catch (error) {
            console.error(`❌ Error getting product ${productId}:`, error);
            return null;
        }
    }

    /**
     * Get multiple products by IDs
     * @param {string[]} productIds - Array of product IDs
     * @returns {Promise<Object[]>} Array of product objects
     */
    async getProductsByIds(productIds) {
        try {
            const products = [];
            const pipeline = client.multi();
            
            // Queue all requests
            productIds.forEach(id => {
                pipeline.json.get(`products:${id}`, { path: '$' });
            });
            
            const results = await pipeline.exec();
            
            // Process results
            results.forEach((result, index) => {
                if (result.result && result.result[0]) {
                    products.push(result.result[0]);
                } else {
                    console.warn(`Product not found: ${productIds[index]}`);
                }
            });
            
            return products;
            
        } catch (error) {
            console.error('❌ Error getting products by IDs:', error);
            return [];
        }
    }

    /**
     * Get products by category
     * @param {string} category - Category name
     * @param {number} limit - Number of products to return
     * @returns {Promise<Object[]>} Array of product objects
     */
    async getProductsByCategory(category, limit = 20) {
        try {
            const results = await client.ft.search('idx:products', `@category:{${category}}`, {
                LIMIT: { from: 0, size: limit },
                DIALECT: 2
            });
            
            const products = [];
            for (const doc of results.documents) {
                try {
                    const product = await client.json.get(doc.id, { path: '$' });
                    if (product && product[0]) {
                        products.push(product[0]);
                    }
                } catch (err) {
                    continue;
                }
            }
            
            return products;
            
        } catch (error) {
            console.error(`❌ Error getting products by category ${category}:`, error);
            return [];
        }
    }
}