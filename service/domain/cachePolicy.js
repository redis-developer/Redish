
export const cachePolicy = [
    {
        topic: "weather",
        keywords: ["weather", "temperature", "forecast"],
        cacheTTLMillis: 60 * 60 * 1000, // 1 hour
    },
    {
        topic: "stocks",
        keywords: ["stock", "price", "NASDAQ", "S&P", "shares"],
        cacheTTLMillis: 5 * 60 * 1000, // 5 minutes
    },
    {
        topic: "news",
        keywords: ["headline", "news", "breaking", "today"],
        cacheTTLMillis: 10 * 60 * 1000, // 10 minutes
    },
    {
        topic: "current time",
        keywords: ["time in", "current time", "timezone"],
        cacheTTLMillis: 2 * 60 * 1000, // 2 minutes
    },
    {
        topic: "static knowledge",
        keywords: ["facts", "information", "explain", "definition", "describe"],
        cacheTTLMillis: 24 * 60 * 60 * 1000, // 1 day
    }
];

export function getQueryPolicy(query) {
    const lowerQuery = query.toLowerCase();
    
    // Find best matching policy based on keywords
    for (const policy of cachePolicy) {
        if (policy.keywords.some(keyword => lowerQuery.includes(keyword))) {
            return policy;
        }
    }
    
    // Default to static knowledge
    return cachePolicy.find(p => p.topic === "static knowledge");
}