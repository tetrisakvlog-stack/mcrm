import { supabase } from "./supabase";

export async function getMyProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function ensureProfile({ id, email, name }) {
  const { data: existing, error: selErr } = await supabase.from("profiles").select("id").eq("id", id).maybeSingle();
  if (selErr) throw selErr;
  if (existing?.id) return;
  const { error } = await supabase.from("profiles").insert([{ id, email, name, role: "user", base_salary: 700, active: true }]);
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

export async function listContacts({ assignedToUserId }) {
  let q = supabase.from("contacts").select("*").order("updated_at", { ascending: false });
  if (assignedToUserId) q = q.eq("assigned_to_user_id", assignedToUserId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function upsertContact(contact) {
  const now = new Date().toISOString();
  const payload = { ...contact, updated_at: now };
  if (!payload.id) payload.created_at = now;
  const { data, error } = await supabase.from("contacts").upsert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteContact(id) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

export async function getSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", "global").single();
  if (error) throw error;
  return data;
}

export async function updateSettings(patch) {
  const { error } = await supabase.from("settings").upsert({ id: "global", ...patch }, { onConflict: "id" });
  if (error) throw error;
}
