import { supabase } from "./supabase";

/** =========================
 *  PROFILES
 *  ========================= */

export async function getMyProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function ensureProfile({ id, email, name }) {
  const { data: existing, error: selErr } = await supabase.from("profiles").select("id").eq("id", id).maybeSingle();
  if (selErr) throw selErr;
  if (existing?.id) return;

  const { error } = await supabase.from("profiles").insert([
    {
      id,
      email,
      name,
      role: "user",
      base_salary: 700,
      active: true,
      alias: null,
      avatar_url: null,
      advances: 0,
    },
  ]);
  if (error) throw error;
}

export async function listProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateProfile(id, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

/** =========================
 *  RECORDS (dochádzka & KPI)
 *  ========================= */

export async function listRecords({ userId, from, to }) {
  let q = supabase.from("records").select("*").gte("date", from).lte("date", to).order("date", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function upsertRecord({ userId, date, present, minutes, successful_calls, accounts }) {
  const payload = { user_id: userId, date, present, minutes, successful_calls, accounts };
  const { error } = await supabase.from("records").upsert(payload, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function deleteRecord({ userId, date }) {
  const { error } = await supabase.from("records").delete().eq("user_id", userId).eq("date", date);
  if (error) throw error;
}

/** =========================
 *  CONTACTS
 *  ========================= */

export async function listContacts({ assignedToUserId } = {}) {
  let q = supabase.from("contacts").select("*");
  if (assignedToUserId) q = q.eq("assigned_to_user_id", assignedToUserId);

  const { data, error } = await q.order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function upsertContact(contact) {
  const payload = { ...contact };
  if (!payload.id) delete payload.id;

  const { data, error } = await supabase.from("contacts").upsert(payload).select("*");
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function deleteContact(id) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

/** =========================
 *  CONTACT CALLS (LOG)
 *  ========================= */

export async function listContactCalls({ contactId, userId } = {}) {
  let q = supabase.from("contact_calls").select("*");
  if (contactId) q = q.eq("contact_id", contactId);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createContactCall(payload) {
  // payload: { contact_id, user_id, channel, result, disposition, employment_status, trading_experience, potential, notes }
  const { data, error } = await supabase.from("contact_calls").insert([payload]).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateContactAfterCall({ contactId, patch }) {
  const { error } = await supabase.from("contacts").update(patch).eq("id", contactId);
  if (error) throw error;
}

/** =========================
 *  SETTINGS
 *  ========================= */

export async function getSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", "global").single();
  if (error) throw error;
  return data;
}

export async function updateSettings(patch) {
  const { error } = await supabase.from("settings").upsert({ id: "global", ...patch }, { onConflict: "id" });
  if (error) throw error;
}

/** =========================
 *  PROFILE CHANGE REQUESTS
 *  ========================= */

export async function createProfileChangeRequest({ userId, kind, payload }) {
  const { data, error } = await supabase
    .from("profile_change_requests")
    .insert([{ user_id: userId, kind, payload, status: "pending" }])
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function listMyProfileChangeRequests(userId) {
  const { data, error } = await supabase
    .from("profile_change_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listPendingProfileChangeRequests() {
  const { data, error } = await supabase
    .from("profile_change_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function reviewProfileChangeRequest({ requestId, approve, note, adminUserId }) {
  const { data: req, error: reqErr } = await supabase.from("profile_change_requests").select("*").eq("id", requestId).single();
  if (reqErr) throw reqErr;

  const newStatus = approve ? "approved" : "rejected";
  const { error: updErr } = await supabase
    .from("profile_change_requests")
    .update({
      status: newStatus,
      note: note || null,
      reviewed_by: adminUserId || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updErr) throw updErr;

  if (approve) {
    if (req.kind === "alias") {
      const alias = (req.payload?.alias ?? "").toString().trim();
      await updateProfile(req.user_id, { alias: alias || null });
    }
    if (req.kind === "avatar") {
      const avatar_url = (req.payload?.avatar_url ?? "").toString().trim();
      await updateProfile(req.user_id, { avatar_url: avatar_url || null });
    }
  }

  return { ...req, status: newStatus };
}

export async function uploadAvatarFile({ userId, file }) {
  if (!file) throw new Error("Chýba súbor.");
  if (!userId) throw new Error("Chýba userId.");

  const ext = (file.name || "png").split(".").pop() || "png";
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${userId}/${Date.now()}_${Math.random().toString(16).slice(2)}.${safeExt}`;

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: false,
    cacheControl: "3600",
    contentType: file.type || "image/png",
  });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) throw new Error("Nepodarilo sa získať URL avatara.");

  return url;
}
