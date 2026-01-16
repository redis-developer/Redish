import { ChatOpenAI } from "@langchain/openai";
import { AIMessage } from "@langchain/core/messages";
import { groceryTools } from "./tools.js";
import { checkSemanticCache, saveToSemanticCache } from "../../chat/domain/chat-service.js";
import { determineToolBasedCacheTTL } from "../helpers/caching.js";
import CONFIG from "../../../config.js";

/**
 * Node 1: Query Cache Check
 */
export const queryCacheCheck = async (state) => {
    const lastUserMessage = state.messages.findLast(m => m.getType() === "human");
    const userQuery = lastUserMessage?.content || "";
    
    console.log(`🔍 Checking semantic cache for: "${userQuery.substring(0, 50)}..."`);
    
    try {
        const cachedResult = await checkSemanticCache(userQuery);

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
 * Node 2: Personal Shopper Agent
 *
 * Specialized agent with tools for shopping-related tasks
 */
export const personalShopperAgent = async (state) => {
    const model = new ChatOpenAI({ 
        temperature: 0.1,
        model: CONFIG.modelName, 
        apiKey: CONFIG.openAiApiKey 
    });

    const systemPrompt = `You are a helpful grocery shopping assistant. You have access to specialized tools that return JSON data.

🍳 **fast_recipe_ingredients**: For recipe/ingredient questions (USE THIS FIRST for recipes!)
- Use when user asks "ingredients for [recipe]" or "what do I need to make [dish]"
- Returns ingredient list with ONE suggested product each for SPEED
- Much faster than searching for each ingredient separately
- Always offer: "Want more options for any ingredient? Just ask!"
- Example: "ingredients for butter chicken" → Use this tool!

🔍 **search_products**: For specific product searches and follow-ups
- Use when user wants to "find [specific item]" or "show me [products]"
- Use when user asks for "more options" or "more brands" after recipe ingredients
- Returns products with cart icons and product page links
- Format: Show products with "🛒 Add to Cart" and "👁️ View Details" options

🛒 **Cart Tools**: For cart management
- add_to_cart: Add products by ID
- view_cart: Show cart contents with totals
- clear_cart: Empty the cart

🧠 **direct_answer**: For general cooking/food knowledge
- Cooking tips, techniques, nutrition advice
- Food storage, preparation methods
- General culinary knowledge (not recipe ingredients!)

**CRITICAL Tool Selection Rules:**
1. Recipe/ingredient questions → ALWAYS use fast_recipe_ingredients FIRST
2. "More options" requests → search_products
3. Cart operations → appropriate cart tool
4. General cooking tips → direct_answer

**Response Formatting Rules:**
1. Parse ALL JSON tool responses before presenting to user
2. For recipe ingredients: Show ingredient + suggested product + cart icon + product link
3. For product searches: Show products with cart icons and "View Details" links  
4. Always include product IDs and make them clickable
5. Use engaging formatting with emojis and clear structure
6. For products, use this exact format: **Product Name** by Brand - ₹Price (ID: 12345) [🛒 Add] [👁️ Details]
7. Make cart icons clickable by using proper product IDs
8. After showing ingredients, always offer: "Want more brands for any ingredient? Just ask!"
9. IMPORTANT: Do NOT create markdown links with # or (). Product IDs should be plain numbers like (ID: 3218). Do not add any JavaScript code.

Session ID: ${state.sessionId}
Make responses helpful, fast, and easy to interact with!`;

    const modelWithTools = model.bindTools(groceryTools);

    try {
        let currentMessages = [
            { role: "system", content: systemPrompt },
            ...state.messages
        ];
        let toolResults = [];
        let foundProducts = [];

        while (true) {
            const response = await modelWithTools.invoke(currentMessages);
            currentMessages.push(response);

            if (!response.tool_calls || response.tool_calls.length === 0) {
                console.log("🛒 Grocery agent finished with direct response");

                return {
                    result: response.content,
                    messages: [...state.messages, new AIMessage(response.content)],
                    toolResults,
                    foundProducts,
                    sessionId: state.sessionId
                };
            }

            for (const toolCall of response.tool_calls) {
                console.log(`🔧 Grocery agent using tool: ${toolCall.name}`);

                // Find and invoke the appropriate tool
                const tool = groceryTools.find(t => t.name === toolCall.name);

                let toolResultString;
                let parsedResult;
                let success = false;
                let error;

                if (tool) {
                    // Add sessionId to tool arguments if needed
                    const toolArgs = { ...toolCall.args };
                    if (['add_to_cart', 'view_cart', 'clear_cart', 'save_to_semantic_cache'].includes(toolCall.name)) {
                        toolArgs.sessionId = state.sessionId;
                    }

                    toolResultString = await tool.invoke(toolArgs);

                    // Parse JSON response
                    try {
                        parsedResult = JSON.parse(toolResultString);
                        success = parsedResult.success !== false;
                        error = parsedResult.error;

                        // Extract products for summary based on tool name
                        if (toolCall.name === "search_products" && parsedResult.products) {
                            foundProducts = parsedResult.products;
                        } else if (toolCall.name === "fast_recipe_ingredients" && parsedResult.ingredientProducts) {
                            foundProducts = parsedResult.ingredientProducts
                                .filter(item => item.suggestedProduct)
                                .map(item => item.suggestedProduct);
                        }
                    } catch (parseError) {
                        console.warn("Could not parse tool result as JSON:", parseError);
                        success = false;
                        error = "Failed to parse tool result";
                    }
                } else {
                    success = false;
                    error = "Unknown tool requested";
                    toolResultString = JSON.stringify({
                        success: false,
                        error
                    });
                }

                // Store structured tool result
                toolResults.push({
                    toolName: toolCall.name,
                    success,
                    error,
                    result: parsedResult
                });

                currentMessages.push({
                    role: "tool",
                    content: toolResultString,
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
            toolResults: [JSON.stringify({ success: false, error: error.message })],
            sessionId: state.sessionId
        };
    }
};

/**
 * Node 3: Process Results for caching
 */
export const processWorkOutputWithCaching = async (state) => {
    if (!state.result) {
        return {};
    }

    const lastUserMessage = state.messages.findLast(m => m.getType() === "human");
    const query = lastUserMessage?.content || "";

    // Determine cache TTL based on tool execution results
    const cacheTTL = determineToolBasedCacheTTL(state.toolResults || []);

    // Don't cache if TTL is 0 (personal/dynamic operations or failures)
    if (cacheTTL === 0) {
        console.log("Skipping cache for personal/dynamic operations or tool failures");
        return {};
    }

    try {
        // Use LLM-based GDPR sanitization
        const [sanitizedQuery, sanitizedResponse ] =  await Promise.all([
            dataComplianceAgent(query),
            dataComplianceAgent(state.result)
        ]);

        console.log(`💾 Saving sanitized query to cache: "${sanitizedQuery.substring(0, 50)}..."`);

        await saveToSemanticCache(
            sanitizedQuery,
            sanitizedResponse,
            cacheTTL,
            state.sessionId
        );

        console.log(`💾 Cached with TTL: ${cacheTTL}ms (${Math.round(cacheTTL / (60 * 60 * 1000))}h)`);

    } catch (error) {
        console.error('Error in GDPR-compliant caching:', error);
        // Don't fail the whole request if caching fails
    }

    return {};
};



/**
 * LLM-based GDPR-compliant data sanitization
 * Uses AI to intelligently remove personal information while preserving the core query
 */
async function dataComplianceAgent(text) {
    if (!text || typeof text !== 'string') return text;

    try {
        const model = new ChatOpenAI({
            temperature: 0,
            model: CONFIG.modelName,
            apiKey: CONFIG.openAiApiKey
        });

        const sanitizationPrompt = `You are a GDPR compliance assistant. Your task is to remove or anonymize any personal information from the given text while preserving the core meaning and context.

Remove or replace the following types of personal information:
- Names (first names, last names, usernames)
- Email addresses
- Phone numbers
- Addresses (street addresses, zip codes)
- Credit card numbers, SSNs, or other ID numbers
- Any other personally identifiable information

IMPORTANT: Keep all food-related terms, product IDs, grocery items, cooking terms, brand names, and the core question intact. Only remove personal identifiers.

Examples:
- "Hi, my name is John, I want butter chicken ingredients" → "I want butter chicken ingredients"
- "I'm Sarah and I live at 123 Main St, what's good for pasta?" → "what's good for pasta?"
- "My email is test@email.com, show me organic apples" → "show me organic apples"

Text to sanitize: "${text}"

Return only the sanitized text with no additional explanation:`;

        const response = await model.invoke(sanitizationPrompt);
        return response.content.trim();

    } catch (error) {
        console.error('Error in LLM sanitization, using original text:', error);
        return text; // Fallback to original text if LLM fails
    }
}
