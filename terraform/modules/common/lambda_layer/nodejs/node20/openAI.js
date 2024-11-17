const axios = require('axios');
const prompt = async ({ q, max_tokens= 500, OPEN_AI_API_KEY, isJSON = false }) => {
    const request = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": `${q}`
            }
        ],
        max_tokens
    };

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', request, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPEN_AI_API_KEY}`,
            },
        });
        console.log(`response :::: `, response.data.choices[0].message.content);
        if (isJSON) {
            const res = response.data.choices[0].message.content || "{}";
            let sanitizedString = res.replace(/```json|```/g, '').trim();
            return JSON.parse(sanitizedString);
        }
        
        return response.data.choices[0].message.content || "";
    } catch (error) {
        console.log(`error on openai fetch `, error);
        return ;
    }
};

const generateImage = async ({ q, OPEN_AI_API_KEY, size = "1024x1024" }) => {
    const request = {
        prompt: q,
        size,
        n: 1,
        model: "dall-e-3",
    };

    try {
        const response = await axios.post('https://api.openai.com/v1/images/generations', request, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPEN_AI_API_KEY}`,
            },
        });
        
        // The image URL is in response.data.data[0].url
        const imageUrl = response.data.data[0].url;
        console.log(`Generated Image URL: `, imageUrl);
        
        return imageUrl;
    } catch (error) {
        console.log(`Error generating image:`, error?.response);
        return;
    }
};

module.exports = {
    prompt,
    generateImage
};