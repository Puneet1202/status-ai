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

// ctx = { db, user, employeeId, env, ... } — user = verified JWT { id, name, email, role }
async function handler(ctx) {
  const u = ctx?.user || {};
  if (!u.name && !u.email && !u.role) {
    return { success: false, action: "GET_PROFILE", reply: "I couldn't read your profile from your session — please log in again." };
  }

  // Designation + joining date are NOT in the JWT — pull them from the DB, but
  // ONLY for the logged-in person (ctx.employeeId, from the verified token). This
  // is self-only by construction: there's no input to ask for anyone else.
  let designation = null;
  let joiningDate = null;
  if (ctx?.db && ctx.employeeId) {
    try {
      const row = await ctx.db
        .prepare(
          `SELECT e.joining_date, d.designation AS designation
             FROM employee e
             LEFT JOIN designation d ON d.id = e.designation_id
            WHERE e.id = ?`
        )
        .bind(ctx.employeeId)
        .first();
      if (row) {
        designation = row.designation || null;
        joiningDate = row.joining_date || null;
      }
    } catch (e) {
      console.warn("[get_my_profile DB lookup failed]", e?.message || e);
    }
  }

  // Clean, professional card (no markdown `**` — the chat UI shows it literally).
  const lines = ["Here's your profile 😊"];
  if (u.name) lines.push(`• Name: ${u.name}`);
  if (u.role) lines.push(`• Role: ${u.role}`);
  if (designation) lines.push(`• Designation: ${designation}`);
  if (u.email) lines.push(`• Email: ${u.email}`);
  if (joiningDate) lines.push(`• Joined: ${joiningDate}`);

  return { success: true, action: "GET_PROFILE", reply: lines.join("\n") };
}

export default { name, schema, handler };
