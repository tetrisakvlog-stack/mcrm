import { supabase } from "./supabase";

/** =========================
 *  Small helpers
 *  ========================= */
function throwIfError(res) {
  if (res?.error) throw res.error;
  return res.data;
}

function shallowMerge(a, b) {
  const out = { ...(a || {}) };
  for (const k of Object.keys(b || {})) {
    const v = b[k];
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = { ...out[k], ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** =========================
 *  Profiles
 *  ========================= */
export async function ensureProfile({ id, email, name }) {
  if (!id) throw new Error("ensureProfile: missing id");
  const payload = {
    id,
    email: email || null,
    name: name || "User",
  };

  // do not overwrite role/active/base_salary etc.
  const res = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  throwIfError(res);
}

export async function getMyProfile(userId) {
  const res = await supabase.from("profiles").select("*").eq("id", userId).single();
  return throwIfError(res);
}

export async function listProfiles() {
  const res = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
  return throwIfError(res) || [];
}

export async function updateProfile(id, patch) {
  const res = await supabase.from("profiles").update(patch).eq("id", id).select("*").single();
  return throwIfError(res);
}

/** =========================
 *  Records (attendance + KPI)
 *  ========================= */
export async function listRecords({ userId = null, from, to }) {
  let q = supabase.from("records").select("*").gte("date", from).lte("date", to).order("date", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const res = await q;
  return throwIfError(res) || [];
}

export async function upsertRecord({ userId, date, present, minutes, successful_calls, accounts }) {
  const payload = {
    user_id: userId,
    date,
    present: !!present,
    minutes: Number(minutes) || 0,
    successful_calls: Number(successful_calls) || 0,
    accounts: Number(accounts) || 0,
  };
  const res = await supabase.from("records").upsert(payload, { onConflict: "user_id,date" }).select("*");
  return throwIfError(res);
}

export async function deleteRecord({ userId, date }) {
  const res = await supabase.from("records").delete().eq("user_id", userId).eq("date", date);
  throwIfError(res);
}

/** =========================
 *  Contacts
 *  ========================= */
export async function listContacts({ assignedToUserId = null } = {}) {
  let q = supabase.from("contacts").select("*").order("updated_at", { ascending: false });
  if (assignedToUserId) q = q.eq("assigned_to_user_id", assignedToUserId);
  const res = await q;
  return throwIfError(res) || [];
}

export async function upsertContact(contact) {
  const c = { ...(contact || {}) };

  // normalize empty strings -> null for some optional fields
  const nullable = [
    "email",
    "company",
    "notes",
    "employment_status",
    "sales_experience",
    "client_potential",
    "next_call_at",
    "last_call_at",
    "last_outcome",
    "last_attitude",
    "last_notes",
  ];
  for (const k of nullable) {
    if (k in c && (c[k] === "" || c[k] === undefined)) c[k] = null;
  }

  // If no id => INSERT (let DB generate uuid)
  if (!c.id) {
    delete c.id;
    const res = await supabase.from("contacts").insert(c).select("*").single();
    return throwIfError(res);
  }

  // With id => UPSERT
  const res = await supabase.from("contacts").upsert(c, { onConflict: "id" }).select("*").single();
  return throwIfError(res);
}

export async function deleteContact(id) {
  const res = await supabase.from("contacts").delete().eq("id", id);
  throwIfError(res);
}

/** =========================
 *  Contact calls log
 *  ========================= */
export async function listContactCalls(contactId) {
  const res = await supabase
    .from("contact_calls")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  return throwIfError(res) || [];
}

export async function createContactCall({ contactId, userId, outcome = null, attitude = null, notes = null }) {
  const payload = {
    contact_id: contactId,
    user_id: userId,
    outcome,
    attitude,
    notes,
  };
  const res = await supabase.from("contact_calls").insert(payload).select("*").single();
  return throwIfError(res);
}

/**
 * Compatibility export (your App.jsx import expects this).
 * This function logs a call and updates the contact in one place.
 *
 * Supported signatures:
 * 1) updateContactAfterCall({ contactId, userId, outcome, attitude, notes, contactPatch })
 * 2) updateContactAfterCall({ contactId, userId, call: { outcome, attitude, notes }, contactPatch })
 */
export async function updateContactAfterCall(args) {
  const contactId = args?.contactId || args?.contact_id;
  const userId = args?.userId || args?.user_id;

  const call = args?.call || {};
  const outcome = args?.outcome ?? call?.outcome ?? null;
  const attitude = args?.attitude ?? call?.attitude ?? null;
  const notes = args?.notes ?? call?.notes ?? null;

  const contactPatch = args?.contactPatch || args?.contact_patch || {};

  if (!contactId) throw new Error("updateContactAfterCall: missing contactId");
  if (!userId) throw new Error("updateContactAfterCall: missing userId");

  // 1) create log
  await createContactCall({ contactId, userId, outcome, attitude, notes });

  // 2) update contact
  const res = await supabase.from("contacts").update(contactPatch).eq("id", contactId).select("*").single();
  return throwIfError(res);
}

/** =========================
 *  Settings
 *  ========================= */
const DEFAULT_SETTINGS = {
  cloudtalk: { enabled: false, backendUrl: "" },
  salary_rules: {
    bonusEnabled: true,
    minutesThreshold: 1200,
    minutesBonus: 50,
    successfulCallsThreshold: 60,
    successfulCallsBonus: 100,
    accountsThreshold: 10,
    accountsBonus: 150,
  },
};

export async function getSettings() {
  // assume single-row table "settings" with id=1
  const res = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  const row = throwIfError(res);

  if (row) {
    return {
      ...row,
      cloudtalk: row.cloudtalk ?? DEFAULT_SETTINGS.cloudtalk,
      salary_rules: row.salary_rules ?? DEFAULT_SETTINGS.salary_rules,
    };
  }

  // if empty, seed defaults
  const ins = await supabase
    .from("settings")
    .insert({ id: 1, cloudtalk: DEFAULT_SETTINGS.cloudtalk, salary_rules: DEFAULT_SETTINGS.salary_rules })
    .select("*")
    .single();
  return throwIfError(ins);
}

export async function updateSettings(patch) {
  const current = await getSettings();
  const merged = shallowMerge(current, patch);

  // keep only known top-level keys if you want strictness; for now, update whatever is passed
  const res = await supabase
    .from("settings")
    .update({
      cloudtalk: merged.cloudtalk,
      salary_rules: merged.salary_rules,
    })
    .eq("id", 1)
    .select("*")
    .single();

  return throwIfError(res);
}

/** =========================
 *  Profile change requests (alias/avatar)
 *  ========================= */
export async function createProfileChangeRequest({ userId, kind, payload }) {
  const res = await supabase
    .from("profile_change_requests")
    .insert({
      user_id: userId,
      kind,
      payload: payload || {},
      status: "pending",
    })
    .select("*")
    .single();
  return throwIfError(res);
}

export async function listMyProfileChangeRequests(userId) {
  const res = await supabase
    .from("profile_change_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return throwIfError(res) || [];
}

export async function listPendingProfileChangeRequests() {
  const res = await supabase
    .from("profile_change_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return throwIfError(res) || [];
}

export async function reviewProfileChangeRequest({ requestId, approve, note = "", adminUserId }) {
  // load request
  const reqRes = await supabase.from("profile_change_requests").select("*").eq("id", requestId).single();
  const req = throwIfError(reqRes);

  const status = approve ? "approved" : "rejected";

  // update request status
  const updReq = await supabase
    .from("profile_change_requests")
    .update({
      status,
      reviewed_by: adminUserId || null,
      reviewed_at: new Date().toISOString(),
      note: note || null,
    })
    .eq("id", requestId);
  throwIfError(updReq);

  // apply to profile if approved
  if (approve) {
    if (req.kind === "alias") {
      const alias = req.payload?.alias ?? null;
      if (alias) await updateProfile(req.user_id, { alias });
    }
    if (req.kind === "avatar") {
      const avatar_url = req.payload?.avatar_url ?? null;
      if (avatar_url) await updateProfile(req.user_id, { avatar_url });
    }
  }

  return true;
}

/** =========================
 *  Avatar upload
 *  ========================= */
export async function uploadAvatarFile({ userId, file }) {
  const bucket = "avatars";
  const ext = (file?.name || "avatar").split(".").pop() || "png";
  const path = `${userId}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

  const up = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file?.type || "image/*",
  });
  throwIfError(up);

  const pub = supabase.storage.from(bucket).getPublicUrl(path);
  const url = pub?.data?.publicUrl;
  if (!url) throw new Error("Nepodarilo sa získať public URL avatara.");
  return url;
}
