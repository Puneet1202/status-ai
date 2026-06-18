// FILE: backend/src/ai/tools/getMyProfile.tool.js
// Read tool — returns the LOGGED-IN user's OWN profile only.
//
// SECURITY: identity comes from ctx.user (the verified JWT) — never from the
// message or any AI-supplied id. The schema exposes NO employee selector, so the
// model has no field in which to request someone else's profile. A user can only
// ever see their own name / email / role / contact / address.

const name = "get_my_profile";

const schema = {
  name,
  description:
    "Return the CURRENT logged-in user's OWN profile — name, email, role, designation, joining date, and (on request) mobile/contact, address, or date of birth. Use for 'who am I', 'my email', 'my mobile number', 'my address', 'meri full detail'.",
  parameters: {
    type: "object",
    properties: {
      field: {
        type: "string",
        description:
          "Optional focus: 'email' | 'mobile' | 'address' | 'dob' | 'full' (everything saved). Omit for the standard card.",
      },
    },
  },
};

// ctx = { db, user, employeeId, env, ... } — user = verified JWT { id, name, email, role }
async function handler(ctx, data = {}) {
  const u = ctx?.user || {};
  if (!u.name && !u.email && !u.role) {
    return { success: false, action: "GET_PROFILE", reply: "I couldn't read your profile from your session — please log in again." };
  }

  // Designation, joining date, DOB, contact + address are NOT in the JWT — pull
  // them from the DB, but ONLY for the logged-in person (ctx.employeeId, from the
  // verified token). Self-only by construction: there's no input for anyone else.
  let row = {};
  if (ctx?.db && ctx.employeeId) {
    try {
      row = (await ctx.db
        .prepare(
          `SELECT e.joining_date, e.dob,
                  e.C_Contact_num, e.P_Contact_num,
                  e.C_Address, e.P_Address,
                  e.city, e.state, e.country,
                  d.designation AS designation
             FROM employee e
             LEFT JOIN designation d ON d.id = e.designation_id
            WHERE e.id = ?`
        )
        .bind(ctx.employeeId)
        .first()) || {};
    } catch (e) {
      console.warn("[get_my_profile DB lookup failed]", e?.message || e);
    }
  }

  const reply = buildProfileReply({
    heading: "Here's your profile 😊",
    name: u.name,
    employeeId: ctx.employeeId,
    role: u.role,
    designation: row.designation,
    email: u.email,
    joining_date: row.joining_date,
    dob: row.dob,
    C_Contact_num: row.C_Contact_num,
    P_Contact_num: row.P_Contact_num,
    C_Address: row.C_Address,
    P_Address: row.P_Address,
    city: row.city,
    state: row.state,
    country: row.country,
    field: data?.field,
  });

  return { success: true, action: "GET_PROFILE", reply };
}

// Shared profile/card formatter — used here and by get_employee_info so the SAME
// fields render the same way. `field` focuses the answer; omit for the base card.
// No markdown `**` (the chat UI shows it literally). A field with no saved value
// says "not on file" rather than an empty line.
export function buildProfileReply(p) {
  const dash = "—";
  const contacts = [p.C_Contact_num, p.P_Contact_num]
    .map((x) => String(x || "").trim()).filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i); // de-dup if current === permanent
  const addresses = [p.C_Address, p.P_Address]
    .map((x) => String(x || "").trim()).filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
  const location = [p.city, p.state, p.country].map((x) => String(x || "").trim()).filter(Boolean).join(", ");

  const f = String(p.field || "").toLowerCase();
  const NS = "Not saved"; // shown ONLY when the DB value is genuinely empty/null

  // Focused single-field answers.
  if (f === "empid" || f === "id")
    return `🆔 Employee ID: ${p.employeeId != null ? p.employeeId : NS}`;
  if (f === "email") return `📧 Email: ${p.email || NS}`;
  if (f === "mobile" || f === "phone" || f === "contact")
    return contacts.length ? `📱 Mobile / contact: ${contacts.join(" · ")}` : `📱 Mobile / contact: ${NS}`;
  if (f === "address") {
    if (!addresses.length && !location) return `🏠 Address: ${NS}`;
    const parts = [];
    if (addresses.length) parts.push(...addresses.map((a) => `• ${a}`));
    if (location) parts.push(`• Location: ${location}`);
    return `🏠 Address:\n${parts.join("\n")}`;
  }
  if (f === "dob") return `🎂 Date of birth: ${p.dob || NS}`;

  // Base card (default) + everything (field === 'full'). Empty optional fields say
  // "Not saved" (the DB has no value) instead of a bare dash, per user request.
  const lines = [];
  if (p.heading) lines.push(p.heading);
  if (p.name) lines.push(`• Name: ${p.name}`);
  if (p.employeeId != null) lines.push(`• Employee ID: ${p.employeeId}`);
  if (p.role) lines.push(`• Role: ${p.role}`);
  lines.push(`• Designation: ${p.designation || dash}`);
  lines.push(`• Email: ${p.email || dash}`);
  lines.push(`• Joined: ${p.joining_date || dash}`);

  if (f === "full") {
    lines.push(`• Mobile: ${contacts.length ? contacts.join(" · ") : NS}`);
    lines.push(`• Address: ${addresses.length ? addresses.join(" | ") : NS}`);
    if (location) lines.push(`• Location: ${location}`);
    lines.push(`• Date of birth: ${p.dob || NS}`);
  }
  return lines.join("\n");
}

export default { name, schema, handler };
