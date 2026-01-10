import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const REMEMBER_KEY = "mcrm_remember_login";

/**
 * Remember login:
 * - true  => localStorage (neodhlási po zavretí prehliadača)
 * - false => sessionStorage (odhlási po zavretí)
 */
export function getRememberLogin() {
  try {
    const v = localStorage.getItem(REMEMBER_KEY);
    // default: TRUE (ako si chcel – neodhlasovať po zavretí)
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function setRememberLogin(remember) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    // ignore
  }
}

// Storage proxy – vždy si vyberie aktuálne localStorage vs sessionStorage
const storageProxy = {
  getItem: (key) => {
    try {
      const st = getRememberLogin() ? window.localStorage : window.sessionStorage;
      return st.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      const st = getRememberLogin() ? window.localStorage : window.sessionStorage;
      st.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: (key) => {
    try {
      const st = getRememberLogin() ? window.localStorage : window.sessionStorage;
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
