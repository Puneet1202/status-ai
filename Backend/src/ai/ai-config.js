// backend/src/ai/ai-config.js

// Production Core Models Reference
export const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const EMBEDDING_MODEL = '@cf/baai/bge-large-en-v1.5';

// Budget Management Hard-Limits
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_TOTAL_CHARS = 52000;