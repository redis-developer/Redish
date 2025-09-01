// ai/grocery-ai-agent/helpers/llm-helper.js
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import CONFIG from '../../../../config.js';

/**
 * Get ingredients from LLM for a recipe
 * @param {string} recipe - Recipe name
 * @returns {Promise<Object>} Parsed ingredients data
 */
export async function getIngredientsFromLLM(recipe) {
    // Use faster model for simple ingredient extraction
    const model = new ChatOpenAI({ 
        temperature: 0.1, // Lower temperature for more consistent parsing
        model: "gpt-4o-mini", // Faster, cheaper model for simple tasks
        apiKey: CONFIG.openAiApiKey,
        maxTokens: 500 // Limit response size for faster processing
    });
    
    const systemPrompt = `Extract essential ingredients for this recipe. Return ONLY valid JSON:

{
  "recipe": "recipe name",
  "ingredients": [
    { "name": "simple ingredient name", "quantity": "amount", "essential": true },
    ...
  ]
}

Rules:
- Max 6 ingredients marked essential: true
- Use simple names: "chicken", "onions", "tomatoes"
- Skip salt, water, oil unless special
- Be concise and fast`;

    // Add timeout to prevent hanging requests
    const response = await Promise.race([
        model.invoke([
            { role: "system", content: systemPrompt },
            new HumanMessage(`Ingredients for ${recipe}`)
        ]),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error("LLM request timeout")), 10000)
        )
    ]);
    
    // Parse the LLM response to get ingredients
    try {
        return JSON.parse(response.content);
    } catch (parseError) {
        throw new Error("Could not parse recipe ingredients. Please try rephrasing your recipe request.");
    }
}

/**
 * Get direct answer from LLM for general questions
 * @param {string} question - User question
 * @returns {Promise<string>} LLM response
 */
export async function getDirectAnswerFromLLM(question) {
    const model = new ChatOpenAI({ 
        temperature: 0.2, 
        model: CONFIG.modelName, 
        apiKey: CONFIG.openAiApiKey 
    });
    
    const systemPrompt = `You are a knowledgeable grocery shopping and cooking assistant. Answer questions about:
- Cooking methods and techniques
- Food storage and preparation tips  
- Nutritional information and health benefits
- Spices, seasonings, and flavor combinations
- Grocery shopping advice and tips
- Indian cuisine and cooking techniques

Provide helpful, accurate information based on your knowledge. Keep responses concise and practical.
Do not mention specific product prices or brands - focus on general knowledge and advice.`;

    const response = await model.invoke([
        { role: "system", content: systemPrompt },
        new HumanMessage(question)
    ]);
    
    return response.content;
}