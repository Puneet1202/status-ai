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
    // Description user ki capability ke hisaab se: team-member wala promise SIRF
    // org-viewer (all_employee_attendance) ko. Plain employee ko sirf apne hours.
    desc: (org) =>
      org
        ? "Log work hours — your own, or for a team member after you select them."
        : "Log your own work hours.",
    actions: [
      { label: "⏱️ Log my hours", value: "log my hours" },
      // ⚠️ Add-for-others — SIRF org-viewer (all_employee_attendance). Plain
      // employee (sirf enter_status) ko ye option KABHI nahi dikhna chahiye.
      { label: "👥 Log for a team member", value: "show employees", orgOnly: true },
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

// Auto friendly-name fallback for a permission not in PERMISSION_INFO (only used
// in the "you don't have X" sub-menu guard — top-level list never names the
// dashboard-only permissions, it just COUNTS them).
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
      return { reply: `You don't have the "${pretty(area)}" permission, so I can't show its actions.` };
    }
    // Org-viewer-only actions (jaise "Log for a team member" = add-for-others) ko
    // non-org user ke liye HATAO. Gate = all_employee_attendance (ctx.isOrgViewer)
    // — same boundary jis pe backend add-for-others/list_employees ko rokta hai.
    // Plain employee ko ye option dikhna hi nahi chahiye (strict). Frontend ko
    // sirf {label, value} bhejo (internal orgOnly flag strip).
    const actions = info.actions
      .filter((a) => !a.orgOnly || ctx.isOrgViewer)
      .map(({ label, value }) => ({ label, value }));
    const desc = typeof info.desc === "function" ? info.desc(ctx.isOrgViewer) : info.desc;
    return {
      success: true,
      action: "MY_PERMISSIONS",
      reply: `${info.label}\n${desc}\n\nWhat would you like to do?`,
      options: actions,
      optionsTitle: "Select an option:",
    };
  }

  // ── TOP LEVEL: full permissions list + chips ─────────────────────────────────
  const all = [...perms];
  if (all.length === 0) {
    return { reply: "You don't have any special permissions assigned — you can manage your own timesheet. ⏱️" };
  }

  // aiPerms = yahan AI me usable; otherPerms = dashboard pe managed. UI markdown
  // bold (**...**) render NAHI karta — to plain text rakho (warna literal `**`
  // dikhta hai, ganda). Aur dashboard-only permissions ko NAAM se list mat karo —
  // sirf GINTI batao (user feedback: "Add Employee" dikhana confusing tha). Total
  // = AI-usable + dashboard, dono ka count saaf.
  const aiPerms = all.filter((p) => PERMISSION_INFO[p]);
  const otherPerms = all.filter((p) => !PERMISSION_INFO[p]);
  const total = all.length;
  const plural = total === 1 ? "" : "s";

  const lines = ["🔐 Your Access", ""];

  // Count summary — professional, bina internal permission naam ke.
  if (aiPerms.length) {
    lines.push(`You have ${total} permission${plural} in total — ${aiPerms.length} usable here with me${otherPerms.length ? ", the rest managed on the dashboard" : ""}.`);
    lines.push("");
    lines.push("What you can do with me:");
    aiPerms.forEach((p) => lines.push(`  ${PERMISSION_INFO[p].label}`));
  } else {
    lines.push(`You have ${total} permission${plural} in total — these are managed on the dashboard, not here in the assistant.`);
  }

  // Baseline (har logged-in user) — apne hours log/view + apna profile. Isse
  // employee ko saaf rahe ki sirf "Status Search" tak limited nahi hai.
  lines.push("");
  lines.push("You can always log & view your own hours and check your own profile too. ⏱️");

  if (aiPerms.length) {
    lines.push("");
    lines.push("Tap an area below to see its actions 👇");
  }

  return {
    success: true,
    action: "MY_PERMISSIONS",
    reply: lines.join("\n"),
    // Chip click → "perm:<area>" deterministic route (chat.js) → opens the sub-menu.
    // Chips sirf AI-usable areas ke (dashboard-only ke yahan koi action nahi).
    options: aiPerms.map((p) => ({ label: PERMISSION_INFO[p].label, value: `perm:${p}` })),
    optionsTitle: aiPerms.length ? "Tap an area to see its actions:" : undefined,
  };
}

export default { name, schema: { name, description: "User's own permissions list + per-permission action menu (deterministic).", parameters: { type: "object", properties: {} } }, handler };
