import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const REMEMBER_KEY = "mcrm_remember_login";

function getRemember() {
  try {
    const v = localStorage.getItem(REMEMBER_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

// Storage proxy – vždy si vyberie aktuálne localStorage vs sessionStorage
const storageProxy = {
  getItem: (key) => {
    try {
      const st = getRemember() ? window.localStorage : window.sessionStorage;
      return st.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      const st = getRemember() ? window.localStorage : window.sessionStorage;
      st.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: (key) => {
    try {
      const st = getRemember() ? window.localStorage : window.sessionStorage;
      st.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: storageProxy,
  },
});
