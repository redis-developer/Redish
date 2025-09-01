// service/domain/grocery-ai-agent/nodes.js
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage } from "@langchain/core/messages";
import { groceryTools } from "./tools.js";
import ChatRepository from "../../chat/data/chat-repository.js";
import CONFIG from "../../../config.js";

const chatRepository = new ChatRepository();

/**
 * Grocery Shopping Agent Node
 * 
 * Specialized agent with improved tool selection for faster responses
 */
export const groceryShoppingAgent = async (state) => {
    const model = new ChatOpenAI({ 
        temperature: 0.1,
        model: CONFIG.modelName, 
        apiKey: CONFIG.openAiApiKey 
    });

    // Enhanced system prompt with clear tool usage guidelines
    const systemPrompt = `You are a helpful grocery shopping assistant. You have access to specialized tools that return JSON data.

🍳 **fastRecipeIngredientsTool**: For recipe/ingredient questions (USE THIS FIRST for recipes!)
- Use when user asks "ingredients for [recipe]" or "what do I need to make [dish]"
- Returns ingredient list with ONE suggested product each for SPEED
- Much faster than searching for each ingredient separately
- Format each product as: **Product Name** by Brand - ₹Price (ID: 12345) [🛒 Add] [👁️ Details]
- Always offer: "Want more options for any ingredient? Just ask!"
- Example: "ingredients for butter chicken" → Use this tool!

🔍 **searchProductsTool**: For specific product searches and follow-ups
- Use when user wants to "find [specific item]" or "show me [products]"
- Use when user asks for "more options" or "more brands" after recipe ingredients
- Returns products with cart icons and product page links
- Format: Show products with "🛒 Add to Cart" and "👁️ View Details" options

🛒 **Cart Tools**: For cart management
- addToCartTool: Add products by ID (parse JSON response)
- viewCartTool: Show cart contents with totals
- clearCartTool: Empty the cart

🧠 **directAnswerTool**: For general cooking/food knowledge
- Cooking tips, techniques, nutrition advice
- Food storage, preparation methods
- General culinary knowledge (not recipe ingredients!)

**CRITICAL Tool Selection Rules:**
1. Recipe/ingredient questions → ALWAYS use fastRecipeIngredientsTool FIRST
2. "More options" requests → searchProductsTool
3. Cart operations → appropriate cart tool
4. General cooking tips → directAnswerTool

**Response Formatting Rules:**
1. Parse ALL JSON tool responses before presenting to user
2. For recipe ingredients: Show ingredient + suggested product + cart icon + product link
3. For product searches: Show products with cart icons and "View Details" links  
4. Always include product IDs and make them clickable
5. Use engaging formatting with emojis and clear structure
6. For products, use this exact format: **Product Name** by Brand - ₹Price (ID: 12345) [🛒 Add] [👁️ Details]
7. Make cart icons clickable by using proper product IDs
8. After showing ingredients, always offer: "Want more brands for any ingredient? Just ask!"
9. IMPORTANT: Do NOT create markdown links with # or (). Product IDs should be plain numbers like (ID: 3218)

Session ID: ${state.sessionId}
Make responses helpful, fast, and easy to interact with!`;

    const modelWithTools = model.bindTools(groceryTools);

    try {
        let currentMessages = [
            { role: "system", content: systemPrompt },
            ...state.messages
        ];
        let toolsUsed = [];
        let foundProducts = [];
        
        while (true) {
            const response = await modelWithTools.invoke(currentMessages);
            currentMessages.push(response);

            if (!response.tool_calls || response.tool_calls.length === 0) {
                console.log("🛒 Grocery agent finished with direct response");
                
                return {
                    result: response.content,
                    messages: [...state.messages, new AIMessage(response.content)],
                    toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["none"],
                    foundProducts,
                    sessionId: state.sessionId
                };
            }

            for (const toolCall of response.tool_calls) {
                let toolResult;
                
                console.log(`🔧 Grocery agent using tool: ${toolCall.name}`);
                toolsUsed.push(toolCall.name);

                // Find and invoke the appropriate tool
                const tool = groceryTools.find(t => t.name === toolCall.name);
                if (tool) {
                    // Add sessionId to tool arguments if needed
                    const toolArgs = { ...toolCall.args };
                    if (['add_to_cart', 'view_cart', 'clear_cart', 'save_to_semantic_cache'].includes(toolCall.name)) {
                        toolArgs.sessionId = state.sessionId;
                    }
                    
                    toolResult = await tool.invoke(toolArgs);
                    
                    // Parse JSON response to extract products for summary
                    try {
                        const parsedResult = JSON.parse(toolResult);
                        if (parsedResult.type === "product_search" && parsedResult.products) {
                            foundProducts = parsedResult.products;
                        } else if (parsedResult.type === "recipe_ingredients" && parsedResult.ingredientProducts) {
                            foundProducts = parsedResult.ingredientProducts
                                .filter(item => item.suggestedProduct)
                                .map(item => item.suggestedProduct);
                        }
                    } catch (parseError) {
                        console.warn("Could not parse tool result as JSON:", parseError);
                    }
                } else {
                    toolResult = JSON.stringify({
                        type: "error",
                        success: false,
                        error: "Unknown tool requested"
                    });
                }

                currentMessages.push({
                    role: "tool",
                    content: toolResult,
                    tool_call_id: toolCall.id,
                });
            }
        }
    } catch (error) {
        console.error("❌ Grocery shopping agent error:", error);
        return {
            result: "I apologize, but I'm having trouble with your grocery request right now. Please try asking about recipe ingredients, searching for products, or managing your cart!",
            messages: [...state.messages, new AIMessage("I apologize, but I'm having trouble with your grocery request right now. Please try asking about recipe ingredients, searching for products, or managing your cart!")],
            toolsUsed: ["error"],
            sessionId: state.sessionId
        };
    }
};

/**
 * Cache Check for Grocery Shopping
 */
export const groceryCacheCheck = async (state) => {
    const lastUserMessage = state.messages.findLast(m => m.getType() === "human");
    const userQuery = lastUserMessage?.content || "";
    
    console.log(`🔍 Checking semantic cache for: "${userQuery.substring(0, 50)}..."`);
    
    
    try {
        const cachedResult = await chatRepository.findFromSemanticCache(state.sessionId, userQuery);
        
        if (cachedResult) {
            console.log("🎯 Semantic cache HIT - returning previous response");
            return {
                cacheStatus: "hit",
                result: cachedResult,
                messages: [...state.messages, new AIMessage(cachedResult)],
                sessionId: state.sessionId
            };
        }
        
        console.log("❌ Semantic cache MISS - proceeding to agent");
        return { 
            cacheStatus: "miss",
            sessionId: state.sessionId
        };
        
    } catch (error) {
        console.error("Error checking semantic cache:", error);
        return { 
            cacheStatus: "miss",
            sessionId: state.sessionId
        };
    }
};

/**
 * Save Grocery Results to Cache
 */
export const saveGroceryToCache = async (state) => {
    if (!state.result) {
        return {};
    }
    
    const lastUserMessage = state.messages.findLast(m => m.getType() === "human");
    const query = lastUserMessage?.content || "";
    
    // Determine cache TTL based on query type
    let cacheTTL = 6 * 60 * 60 * 1000; // 6 hours default
    
    // Longer TTL for recipe/ingredient queries (they don't change often)
    if (query.toLowerCase().includes('recipe') || 
        query.toLowerCase().includes('ingredients') || 
        query.toLowerCase().includes('how to make') ||
        query.toLowerCase().includes('need for') ||
        query.toLowerCase().includes('to make')) {
        cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
    }
    
    // Shorter TTL for price/shopping queries (prices change)
    if (query.toLowerCase().includes('price') || 
        query.toLowerCase().includes('cost') || 
        query.toLowerCase().includes('cheap')) {
        cacheTTL = 2 * 60 * 60 * 1000; // 2 hours
    }
    
    // Don't cache cart operations (they're user-specific and dynamic)
    if (query.toLowerCase().includes('cart') || 
        query.toLowerCase().includes('add to') || 
        query.toLowerCase().includes('remove')) {
        console.log("⏭️ Skipping cache for cart operation");
        return {};
    }
    
    await chatRepository.saveResponseInSemanticCache( 
        query, 
        state.result, 
        cacheTTL,
        state.sessionId,
    );
    
    console.log(`💾 Saved grocery result to cache with TTL: ${cacheTTL}ms`);
    return {};
};