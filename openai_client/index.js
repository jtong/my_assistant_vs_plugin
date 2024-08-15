// openai_processor.js
const OpenAI = require('openai');
const { HttpsProxyAgent } = require('https-proxy-agent');


class OpenAIProcessor {
    constructor(apiKey, model) {
        let config = {
            apiKey: apiKey,
        };
        if (process.env.https_proxy) {
            config.httpAgent = new HttpsProxyAgent(process.env.https_proxy);
        }
        this.openai = new OpenAI(config);
        this.model = model;
    }


    async processPrompt(prompt) {
        try {
            const chatCompletion = await this.openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: this.model,
            });

            let responseText = chatCompletion.choices[0]?.message?.content;

            return responseText.trim();
        } catch (error) {
            console.error('An error occurred:', error);
            throw error;
        }
    }

    // 处理多条消息
    async processMessages(messages) {
        try {
            const chatCompletion = await this.openai.chat.completions.create({
                messages: messages, // 直接使用传入的消息数组
                model: this.model,
            });

            // 提取并返回所有响应消息的内容
            let responses = chatCompletion.choices[0]?.message?.content;
            return responses.trim();
        } catch (error) {
            console.error('An error occurred:', error);
            throw error;
        }
    }

    // 新增的流式处理方法
    async processPromptStream(prompt) {
        try {
            const stream = await this.openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: this.model,
                stream: true,
            });

            const response = new Response('');
            response.setStream(this.createStream(stream));

            return response;
        } catch (error) {
            console.error('An error occurred:', error);
            throw error;
        }
    }

    // 新增的流式处理方法
    async processMessagesStream(messages) {
        try {
            const stream = await this.openai.chat.completions.create({
                messages: messages,
                model: this.model,
                stream: true,
            });

            const response = new Response('');
            response.setStream(this.createStream(stream));

            return response;
        } catch (error) {
            console.error('An error occurred:', error);
            throw error;
        }
    }

    async *createStream(stream) {
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                yield content;
            }
        }
    }
}

module.exports = OpenAIProcessor;
