// FILE: backend/src/ai/tools/index.js
// SINGLE SOURCE OF TRUTH for tools. The model's function schemas, the prompt's
// routing directory, and the runtime dispatcher all DERIVE from MODULES below.
//
// 👉 To add a new tool (Leave Request, Invoice Generation, ...):
//    1. Create  ./leaveRequest.tool.js  exporting { name, schema, handler }.
//    2. Import it and add it to MODULES.
//    That's it. No edits to chat.js, the controller, or the prompt.

import addTimesheet from "./addTimesheet.tool.js";
import getTimesheet from "./getTimesheet.tool.js";
import updateTimesheet from "./updateTimesheet.tool.js";
import deleteTimesheet from "./deleteTimesheet.tool.js";
import getMyProfile from "./getMyProfile.tool.js";
import analyzeTimesheet from "./analyzeTimesheet.tool.js";
import queryTimesheet from "./queryTimesheet.tool.js";

const MODULES = [addTimesheet, getTimesheet, updateTimesheet, deleteTimesheet, getMyProfile, analyzeTimesheet, queryTimesheet];

// name -> module
export const REGISTRY = Object.fromEntries(MODULES.map((m) => [m.name, m]));

// Llama / OpenAI function-calling schema array (passed to env.AI.run).
export function getToolSchemas() {
  return MODULES.map((m) => ({ type: "function", function: m.schema }));
}

// Human-readable routing block injected into the system prompt so the model
// always knows the current toolset without hand-maintained prose.
export function getToolDirectory() {
  return MODULES.map((m) => `- ${m.name}: ${m.schema.description}`).join("\n");
}

// Single dispatch entry-point. ctx = { db, user, env, selectedProject, today }.
export async function dispatchTool(toolName, args, ctx) {
  const tool = REGISTRY[toolName];
  if (!tool) {
    return { reply: "I can't perform that action yet." };
  }
  return tool.handler(ctx, args || {});
}
