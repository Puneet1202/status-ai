// FILE: backend/src/ai/providers/cloudflare.js
// V2.5 - REFACTORED WORKERS AI INTEGRATION WITH POLYMORPHIC TOOL RUNNER

import { CHAT_MODEL, MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS, AI_TIMEOUT_MS } from '../ai-config.js';

/**
 * Hard timeout guard around any promise. If the edge model stalls past `ms`,
 * we reject with a `<label>_TIMEOUT` error so the caller can degrade gracefully
 * instead of hanging the worker until the platform force-kills the request.
 */
function withTimeout(promise, ms, label = 'AI') {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Message Normalization Layer - Combines overlapping roles and truncates over-budget contexts
 */
export function normalizeMessages(messages = []) {
    const validMessages = [];
    let totalChars = 0;

    for (const item of messages) {
        if (!item || typeof item.content !== 'string' || !item.content.trim()) continue;

        const role = item.role === 'system' || item.role === 'assistant' ? item.role : 'user';
        let content = item.content.trim();

        if (content.length > MAX_MESSAGE_CHARS) {
            content = `${content.slice(0, MAX_MESSAGE_CHARS)}\n[Message truncated to stay within AI context limits]`;
        }

        if (totalChars + content.length > MAX_TOTAL_CHARS) {
            const remainingChars = MAX_TOTAL_CHARS - totalChars;
            if (remainingChars <= 200) break;
            content = `${content.slice(0, remainingChars)}\n[Context truncated to stay within AI context limits]`;
        }

        const previous = validMessages[validMessages.length - 1];

        if (previous?.role === role && role !== 'system') {
            previous.content += `\n${content}`;
        } else {
            validMessages.push({ role, content });
        }

        totalChars += content.length;
    }

    return validMessages;
}

/**
 * Fallback Text Extractor Layer - Prevents server runtime crash when parsing deep nested objects
 */
function extractText(response) {
    if (!response) throw new Error('Cloudflare AI returned an empty response object');

    if (response?.result?.choices?.[0]?.message?.content) return response.result.choices[0].message.content;
    if (response?.choices?.[0]?.message?.content) return response.choices[0].message.content;
    if (typeof response?.result?.response === 'string') return response.result.response;
    if (typeof response?.response === 'string') return response.response;
    if (typeof response === 'string') return response;

    if (response?.response && typeof response.response === 'object') {
        return JSON.stringify(response.response);
    }

    throw new Error('Cloudflare AI response did not include standard string output text');
}

/**
 * High-Level Request Gateway - Wrapper to safely query Cloudflare Workers AI platform
 * ✅ NOW SUPPORTS POLYMORPHIC TOOL CALLS MATRIX
 */
export async function askCloudflareAI(systemPrompt, message, history = [], env, tools = null) {
    if (!env?.AI?.run) {
        throw new Error('Cloudflare AI system binding connection is missing. Ensure wrangler.toml contains [ai] configurations.');
    }

    const messages = normalizeMessages([
        { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
        ...history,
        { role: 'user', content: message || 'Hello' }
    ]);

    const payload = {
        messages,
        temperature: 0.1, // Highly locked down token settings for absolute mathematical response accuracy
        max_tokens: 1000  // Increased budget slightly to prevent tool extraction cutoff tokens
    };

    // 🔥 DYNAMIC LINK: Agar controller/chat layer se tools ka array aaya hai, toh payload mein bind karo
    if (tools && Array.isArray(tools) && tools.length > 0) {
        payload.tools = tools;
    }

    const response = await withTimeout(env.AI.run(CHAT_MODEL, payload), AI_TIMEOUT_MS, 'WORKERS_AI');

    // 🚨 PROTECTION FILTER: Agar response ke andar native 'tool_calls' exist karta hai, 
    // toh text extract mat karo, balki poora raw object return karo taaki chat.js use catch kar sake!
    if (response.tool_calls && response.tool_calls.length > 0) {
        return response; 
    }

    // Normal conversational flowchart path
    return extractText(response).trim();
}