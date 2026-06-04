// FILE: backend/src/ai/tools/getMyProfile.tool.js
// Read tool — returns the LOGGED-IN user's OWN profile only.
//
// SECURITY: identity comes from ctx.user (the verified JWT) — never from the
// message or any AI-supplied id. The schema exposes NO parameters, so the model
// has no field in which to request someone else's profile. A user can only ever
// see their own name / email / role.

const name = "get_my_profile";

const schema = {
  name,
  description:
    "Return the CURRENT logged-in user's own profile (their name, email, role). Use when the user asks things like 'what is my name', 'who am I', 'my email', or 'what's my role'.",
  parameters: { type: "object", properties: {} }, // no inputs — identity is from the token
};

// ctx = { db, user, env, ... }  — user = verified JWT { id, name, email, role }
async function handler(ctx) {
  const u = ctx?.user || {};
  if (!u.name && !u.email && !u.role) {
    return { success: false, action: "GET_PROFILE", reply: "I couldn't read your profile from your session — please log in again." };
  }

  const bits = [];
  if (u.name) bits.push(`your name is **${u.name}**`);
  if (u.email) bits.push(`email **${u.email}**`);
  if (u.role) bits.push(`role **${u.role}**`);

  // "your name is X, email Y, role Z."
  const reply = `Here's your profile — ${bits.join(", ")}. 😊`;
  return { success: true, action: "GET_PROFILE", reply };
}

export default { name, schema, handler };
