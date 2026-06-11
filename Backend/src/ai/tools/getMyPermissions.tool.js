// FILE: backend/src/ai/tools/getMyPermissions.tool.js
// "Mere paas kya permissions hain?" — user ki LIVE permissions (ctx.perms, har
// request pe DB se fresh) list karta hai + clickable chips. Chip pe click → us
// permission ka "mode" khulta hai (related AI actions ke chips).
//
// SECURITY/UX: permissions sensitive hai → ye tool 100% DETERMINISTIC route hota
// hai (chat.js se), model kabhi involve nahi — to koi permission hallucinate nahi
// ho sakti. Sub-menu bhi sirf UNHI permissions ka khulta hai jo user ke paas HAIN.

const name = "get_my_permissions";

// Sirf wo permissions jinke AI me actual actions hai. Baaki (add_employee,
// manage_roles, assign_leaves...) dashboard ke kaam hai → "Dashboard me" dikhते hai.
const PERMISSION_INFO = {
  manage_employee: {
    label: "👥 Employee Management",
    desc: "View, search, and look up details of employees.",
    actions: [
      { label: "📋 List all employees", value: "show employees" },
      { label: "🔎 Search by name or email", value: "show employees" },
    ],
  },
  all_employee_attendance: {
    label: "📊 Team Status & Attendance",
    desc: "See who has or hasn't submitted their status, plus anyone's hours and attendance.",
    actions: [
      { label: "📋 Pending today", value: "who is pending today" },
      { label: "📅 Pending this week", value: "who is pending this week" },
    ],
  },
  enter_status: {
    label: "⏱️ Status & Hours Entry",
    desc: "Log work hours — your own, or for a team member after you select them.",
    actions: [
      { label: "⏱️ Log my hours", value: "log my hours" },
      { label: "👥 Log for a team member", value: "show employees" },
      { label: "📋 My recent logs", value: "my recent logs" },
    ],
  },
  search_status: {
    label: "🔍 Status Search",
    desc: "Search through status records.",
    actions: [
      { label: "📋 My recent logs", value: "my recent logs" },
    ],
  },
};

// Auto friendly-name fallback for permissions not in PERMISSION_INFO.
function pretty(p) {
  return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ctx = { perms: Set<string>, isOrgViewer, ... }; data.area = ek permission name (chip click)
async function handler(ctx, data) {
  const perms = ctx.perms instanceof Set ? ctx.perms : new Set();
  const have = (p) => perms.has(p);

  // ── SUB-MENU: ek permission ka mode (chip pe click) ──────────────────────────
  if (data && data.area) {
    const area = String(data.area).trim();
    const info = PERMISSION_INFO[area];
    // Security: open a permission's mode only if the user actually HAS it.
    if (!info || !have(area)) {
      return { reply: `You don't have the **${pretty(area)}** permission, so I can't show its actions.` };
    }
    return {
      success: true,
      action: "MY_PERMISSIONS",
      reply: `${info.label}\n${info.desc}\n\nWhat would you like to do?`,
      options: info.actions,
      optionsTitle: "Select an option:",
    };
  }

  // ── TOP LEVEL: full permissions list + chips ─────────────────────────────────
  const all = [...perms];
  if (all.length === 0) {
    return { reply: "You don't have any special permissions assigned — you can manage your own timesheet. ⏱️" };
  }

  // AI-actionable permissions (have actions here). Dashboard-only ones are part of
  // the total count but not listed — they're managed on the website, not here.
  const aiPerms = all.filter((p) => PERMISSION_INFO[p]);

  const lines = [`You have **${all.length} permissions** in total.`];
  if (aiPerms.length) {
    lines.push(`Here's what you can do with me right now 👇\n`);
    aiPerms.forEach((p) => lines.push(`  • ${PERMISSION_INFO[p].label}`));
  } else {
    lines.push(`None of them are available here in the assistant — they're managed on the dashboard.`);
  }

  return {
    success: true,
    action: "MY_PERMISSIONS",
    reply: lines.join("\n"),
    // Chip click → "perm:<area>" deterministic route (chat.js) → opens the sub-menu.
    options: aiPerms.map((p) => ({ label: PERMISSION_INFO[p].label, value: `perm:${p}` })),
    optionsTitle: "Tap an area to see its actions:",
  };
}

export default { name, schema: { name, description: "User's own permissions list + per-permission action menu (deterministic).", parameters: { type: "object", properties: {} } }, handler };
