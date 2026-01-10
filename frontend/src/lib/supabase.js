import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Rovnaký kľúč ako v App.jsx
const REMEMBER_KEY = "mcrm_remember_login";

function getRemember() {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return true; // fallback: bezpečnejšie default "remember"
  }
}

function pickStorage() {
  // remember = localStorage (prežije zavretie prehliadača)
  // no-remember = sessionStorage (zmaže sa po zavretí)
  try {
    return getRemember() ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: pickStorage(),
  },
});
