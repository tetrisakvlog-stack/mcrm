import React, { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  LogOut,
  Shield,
  User,
  Clock,
  PhoneCall,
  ClipboardList,
  Calculator,
  Phone,
  Settings,
  Plus,
  Search,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  Input,
  Label,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "./ui/ui.jsx";

import { supabase } from "./lib/supabase";
import {
  ensureProfile,
  getMyProfile,
  listProfiles,
  updateProfile,
  listRecords,
  upsertRecord,
  deleteRecord,
  listContacts,
  upsertContact,
  deleteContact,
  getSettings,
  updateSettings,
} from "./lib/db.js";

/** =========================
 *  THEME (biela / tmavá / systém)
 *  - ukladá sa do localStorage
 *  - "system" sleduje prefers-color-scheme
 *  - prepína html.dark
 *  ========================= */
function getSystemTheme() {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
function resolveTheme(mode) {
  return mode === "system" ? getSystemTheme() : mode;
}
function applyTheme(mode) {
  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("mcrm_theme") || "system");

  useEffect(() => {
    localStorage.setItem("mcrm_theme", theme);
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;

    const handler = () => {
      const current = localStorage.getItem("mcrm_theme") || "system";
      if (current === "system") applyTheme("system");
    };

    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return { theme, setTheme };
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      className="
        h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none
        focus:ring-2 focus:ring-zinc-300
        dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:ring-slate-600
      "
      aria-label="Téma"
      title="Téma"
    >
      <option value="light">biela</option>
      <option value="dark">tmavá</option>
      <option value="system">systém</option>
    </select>
  );
}

/** =========================
 *  Helpers
 *  ========================= */
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function startOfMonthISO(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}
function endOfMonthISO(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  const yyyy = d.getFullYear();
  const mm = d.getMonth();
  const last = new Date(yyyy, mm + 1, 0);
  const dd = String(last.getDate()).padStart(2, "0");
  return `${yyyy}-${String(mm + 1).padStart(2, "0")}-${dd}`;
}
function trimTrailingSlash(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
function isLikelyE164(phone) {
  const p = (phone || "").trim();
  if (!p.startsWith("+")) return false;
  const digits = p.slice(1);
  if (digits.length < 8 || digits.length > 15) return false;
  for (let i = 0; i < digits.length; i++) {
    const c = digits[i];
    if (c < "0" || c > "9") return false;
  }
  return true;
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-zinc-100 flex items-center justify-center dark:bg-slate-800/60">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-zinc-600 dark:text-slate-300">{label}</div>
          <div className="text-xl font-semibold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const { theme, setTheme } = useTheme();

  const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });

  const isAdmin = profile?.role === "admin";

  const [periodISO, setPeriodISO] = useState(() => todayISO());
  const monthStart = useMemo(() => startOfMonthISO(periodISO), [periodISO]);
  const monthEnd = useMemo(() => endOfMonthISO(periodISO), [periodISO]);

  const [profiles, setProfiles] = useState([]);
  const [records, setRecords] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      setProfiles([]);
      setRecords([]);
      setContacts([]);
      setSettings(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const u = session.user;
        const name = u.user_metadata?.name || u.email?.split("@")?.[0] || "User";
        await ensureProfile({ id: u.id, email: u.email, name });
        const my = await getMyProfile(u.id);
        if (cancelled) return;
        setProfile(my);
        setSettings(await getSettings());
      } catch (e) {
        toast.error(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !profile?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const userIdFilter = isAdmin ? null : profile.id;
        const [r, c] = await Promise.all([
          listRecords({ userId: userIdFilter, from: monthStart, to: monthEnd }),
          listContacts({ assignedToUserId: isAdmin ? null : profile.id }),
        ]);
        if (cancelled) return;
        setRecords(r);
        setContacts(c);
      } catch (e) {
        toast.error(String(e?.message || e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, profile?.id, isAdmin, monthStart, monthEnd]);

  useEffect(() => {
    if (!session?.user?.id || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await listProfiles();
        if (!cancelled) setProfiles(p);
      } catch (e) {
        toast.error(String(e?.message || e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, isAdmin]);

  async function login() {
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return toast.error(error.message);
  }

  async function register() {
    const name = authForm.name.trim();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    if (!name) return toast.error("Zadaj meno.");
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return toast.error(error.message);
    toast.success("Registrácia OK. Ak máš zapnutý email confirm, potvrď email.");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function refreshData() {
    if (!profile?.id) return;
    try {
      const userIdFilter = isAdmin ? null : profile.id;
      const [r, c, s] = await Promise.all([
        listRecords({ userId: userIdFilter, from: monthStart, to: monthEnd }),
        listContacts({ assignedToUserId: isAdmin ? null : profile.id }),
        getSettings(),
      ]);
      setRecords(r);
      setContacts(c);
      setSettings(s);
      if (isAdmin) setProfiles(await listProfiles());
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  async function saveMySip(sip) {
    try {
      await updateProfile(profile.id, { sip_username: sip.username, sip_password: sip.password, sip_domain: sip.domain });
      setProfile(await getMyProfile(profile.id));
      toast.success("SIP uložené.");
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  async function initiateCall(contact) {
    if (!settings?.cloudtalk?.enabled) return toast.error("CloudTalk nie je zapnutý (admin).");
    if (!profile?.cloudtalk_agent_id) return toast.error("Chýba CloudTalk agent_id (admin ho nastaví).");
    const phone = (contact.phone || "").trim();
    if (!isLikelyE164(phone)) return toast.error("Neplatné číslo. Použi E.164 napr. +421901234567.");

    const backendUrl = trimTrailingSlash(import.meta.env.VITE_MCRM_BACKEND_URL || settings?.cloudtalk?.backendUrl || "");
    if (!backendUrl) return toast.error("Chýba backend URL.");

    try {
      const res = await fetch(`${backendUrl}/api/cloudtalk/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: profile.cloudtalk_agent_id, callee_number: phone }),
      });
      if (!res.ok) throw new Error(await res.text());
      await upsertContact({ ...contact, status: "called", last_call_at: new Date().toISOString() });
      toast.success("Volanie spustené.");
      await refreshData();
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  const pageShell = "min-h-screen bg-white text-zinc-900 dark:bg-slate-950 dark:text-slate-100";

  if (missingEnv) {
    return (
      <div className={`${pageShell} p-6 relative`}>
        <div className="absolute top-4 right-4">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>mcrm – chýbajú ENV premenné</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-700 dark:text-slate-300">
            <div>Nastav vo Vercel:</div>
            <div className="font-mono">VITE_SUPABASE_URL</div>
            <div className="font-mono">VITE_SUPABASE_ANON_KEY</div>
            <div className="font-mono">VITE_MCRM_BACKEND_URL</div>
          </CardContent>
        </Card>
        <Toaster position="top-right" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${pageShell} p-6 relative`}>
        <div className="absolute top-4 right-4">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        <div className="text-sm text-zinc-600 dark:text-slate-300">Načítavam…</div>
        <Toaster position="top-right" />
      </div>
    );
  }

  if (!session?.user?.id || !profile) {
    return (
      <div className={`${pageShell} p-4 md:p-8 relative`}>
        <div className="absolute top-4 right-4">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">mcrm</CardTitle>
              <div className="text-sm text-zinc-600 dark:text-slate-300">Prihlásenie / registrácia</div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={authMode === "login" ? "primary" : "outline"}
                  className="w-full"
                  onClick={() => setAuthMode("login")}
                >
                  Prihlásiť
                </Button>
                <Button
                  variant={authMode === "register" ? "primary" : "outline"}
                  className="w-full"
                  onClick={() => setAuthMode("register")}
                >
                  Registrovať
                </Button>
              </div>

              {authMode === "register" && (
                <div className="space-y-2">
                  <Label>Meno</Label>
                  <Input
                    value={authForm.name}
                    onChange={(e) => setAuthForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ján Novák"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={authForm.email}
                  onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="meno@firma.sk"
                />
              </div>

              <div className="space-y-2">
                <Label>Heslo</Label>
                <Input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>

              <Button className="w-full" onClick={authMode === "login" ? login : register}>
                {authMode === "login" ? "Prihlásiť" : "Vytvoriť účet"}
              </Button>
            </CardContent>
          </Card>
        </div>
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div className={pageShell}>
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-zinc-600 dark:text-slate-300">mcrm</div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-semibold truncate">{profile.name}</div>
              {isAdmin ? (
                <Badge className="inline-flex items-center gap-1">
                  <Shield className="h-3 w-3" /> admin
                </Badge>
              ) : (
                <Badge className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" /> user
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} setTheme={setTheme} />

            <div className="hidden sm:flex items-center gap-2">
              <Label className="text-xs">Mesiac</Label>
              <Input className="w-[160px]" type="date" value={periodISO} onChange={(e) => setPeriodISO(e.target.value)} />
            </div>

            <Button variant="outline" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
        <div className="sm:hidden">
          <Label>Mesiac</Label>
          <Input type="date" value={periodISO} onChange={(e) => setPeriodISO(e.target.value)} />
        </div>

        <DashboardOverview profile={profile} records={records} monthStart={monthStart} monthEnd={monthEnd} />

        <MainTabs
          profile={profile}
          isAdmin={isAdmin}
          profiles={profiles}
          monthStart={monthStart}
          monthEnd={monthEnd}
          records={records}
          contacts={contacts}
          settings={settings}
          saveMySip={saveMySip}
          refreshData={refreshData}
          onUpsertRecord={async (userId, date, patch) => {
            try {
              await upsertRecord({ userId, date, ...patch });
              toast.success("KPI uložené.");
              await refreshData();
            } catch (e) {
              toast.error(String(e?.message || e));
            }
          }}
          onDeleteRecord={async (userId, date) => {
            try {
              await deleteRecord({ userId, date });
              toast.success("Záznam zmazaný.");
              await refreshData();
            } catch (e) {
              toast.error(String(e?.message || e));
            }
          }}
          onUpsertContact={async (c) => {
            try {
              await upsertContact(c);
              toast.success("Kontakt uložený.");
              await refreshData();
            } catch (e) {
              toast.error(String(e?.message || e));
            }
          }}
          onDeleteContact={async (id) => {
            try {
              await deleteContact(id);
              toast.success("Kontakt zmazaný.");
              await refreshData();
            } catch (e) {
              toast.error(String(e?.message || e));
            }
          }}
          initiateCall={initiateCall}
          updateUser={async (id, patch) => {
            try {
              await updateProfile(id, patch);
              toast.success("Uložené.");
              await refreshData();
            } catch (e) {
              toast.error(String(e?.message || e));
            }
          }}
          updateSettings={async (patch) => {
            try {
              await updateSettings(patch);
              setSettings(await getSettings());
              toast.success("Nastavenia uložené.");
            } catch (e) {
              toast.error(String(e?.message || e));
            }
          }}
        />
      </div>

      <Toaster position="top-right" />
    </div>
  );
}

function DashboardOverview({ profile, records, monthStart, monthEnd }) {
  const rows = records.filter((r) => r.user_id === profile.id);
  const presentDays = rows.filter((r) => r.present).length;
  const minutes = rows.reduce((a, r) => a + (Number(r.minutes) || 0), 0);
  const successfulCalls = rows.reduce((a, r) => a + (Number(r.successful_calls) || 0), 0);
  const accounts = rows.reduce((a, r) => a + (Number(r.accounts) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="text-sm text-zinc-600 dark:text-slate-300">
        Prehľad za {monthStart} → {monthEnd}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={ClipboardList} label="Dochádzka (dni)" value={presentDays} />
        <Stat icon={Clock} label="Navolané minúty" value={minutes} />
        <Stat icon={PhoneCall} label="Úspešné hovory" value={successfulCalls} />
        <Stat icon={Calculator} label="Založené účty" value={accounts} />
      </div>
    </div>
  );
}

function MainTabs({
  profile,
  isAdmin,
  profiles,
  monthStart,
  monthEnd,
  records,
  contacts,
  settings,
  saveMySip,
  refreshData,
  onUpsertRecord,
  onDeleteRecord,
  onUpsertContact,
  onDeleteContact,
  initiateCall,
  updateUser,
  updateSettings,
}) {
  const [tab, setTab] = useState("my");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="grid grid-cols-2 sm:grid-cols-5 rounded-2xl">
        <TabsTrigger value="my">Môj profil</TabsTrigger>
        <TabsTrigger value="records">Dochádzka & KPI</TabsTrigger>
        <TabsTrigger value="contacts">Kontakty</TabsTrigger>
        <TabsTrigger value="salary">Výplaty</TabsTrigger>
        <TabsTrigger value="admin" disabled={!isAdmin}>
          Admin
        </TabsTrigger>
      </TabsList>

      <TabsContent value="my" className="mt-4">
        <MyProfile profile={profile} saveMySip={saveMySip} />
      </TabsContent>

      <TabsContent value="records" className="mt-4">
        <RecordsUI
          isAdmin={isAdmin}
          profile={profile}
          profiles={profiles}
          records={records}
          monthStart={monthStart}
          monthEnd={monthEnd}
          onUpsertRecord={onUpsertRecord}
          onDeleteRecord={onDeleteRecord}
        />
      </TabsContent>

      <TabsContent value="contacts" className="mt-4">
        <ContactsUI
          isAdmin={isAdmin}
          profile={profile}
          profiles={profiles}
          contacts={contacts}
          onUpsertContact={onUpsertContact}
          onDeleteContact={onDeleteContact}
          initiateCall={initiateCall}
        />
      </TabsContent>

      <TabsContent value="salary" className="mt-4">
        <SalaryUI
          isAdmin={isAdmin}
          profile={profile}
          profiles={profiles}
          records={records}
          settings={settings}
          monthStart={monthStart}
          monthEnd={monthEnd}
        />
      </TabsContent>

      <TabsContent value="admin" className="mt-4">
        {isAdmin ? (
          <AdminUI profiles={profiles} settings={settings} updateUser={updateUser} updateSettings={updateSettings} />
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-zinc-600 dark:text-slate-300">
              Nemáš admin oprávnenie.
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <div className="mt-3">
        <Button variant="outline" onClick={refreshData}>
          Obnoviť dáta
        </Button>
      </div>
    </Tabs>
  );
}

function MyProfile({ profile, saveMySip }) {
  const [sip, setSip] = useState({
    username: profile.sip_username || "",
    password: profile.sip_password || "",
    domain: profile.sip_domain || "",
  });

  useEffect(() => {
    setSip({
      username: profile.sip_username || "",
      password: profile.sip_password || "",
      domain: profile.sip_domain || "",
    });
  }, [profile.id]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-2">
          <Row label="Meno" value={profile.name} />
          <Row label="Email" value={profile.email} />
          <Row label="Rola" value={profile.role} />
          <Row label="Základná mzda" value={`${profile.base_salary} €`} />
          <Row label="CloudTalk agent_id" value={profile.cloudtalk_agent_id ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SIP údaje</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>SIP Username</Label>
              <Input value={sip.username} onChange={(e) => setSip((p) => ({ ...p, username: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>SIP Password</Label>
              <Input
                type="password"
                value={sip.password}
                onChange={(e) => setSip((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>SIP Domain</Label>
              <Input value={sip.domain} onChange={(e) => setSip((p) => ({ ...p, domain: e.target.value }))} />
            </div>
          </div>
          <Button onClick={() => saveMySip(sip)}>Uložiť SIP</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-zinc-600 dark:text-slate-300">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function RecordsUI({ isAdmin, profile, profiles, records, monthStart, monthEnd, onUpsertRecord, onDeleteRecord }) {
  const [selectedUserId, setSelectedUserId] = useState(profile.id);
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState({ present: false, minutes: 0, successful_calls: 0, accounts: 0 });

  const options = isAdmin ? profiles.filter((p) => p.active) : [profile];
  const rows = useMemo(() => records.filter((r) => r.user_id === selectedUserId), [records, selectedUserId]);
  const existing = useMemo(() => rows.find((r) => r.date === date) || null, [rows, date]);

  useEffect(() => {
    if (existing) {
      setForm({
        present: !!existing.present,
        minutes: existing.minutes ?? 0,
        successful_calls: existing.successful_calls ?? 0,
        accounts: existing.accounts ?? 0,
      });
    } else {
      setForm({ present: false, minutes: 0, successful_calls: 0, accounts: 0 });
    }
  }, [existing?.id]);

  useEffect(() => {
    if (!isAdmin) setSelectedUserId(profile.id);
  }, [isAdmin, profile.id]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Záznam dňa</CardTitle>
          <div className="text-sm text-zinc-600 dark:text-slate-300">Obdobie {monthStart} → {monthEnd}</div>
        </CardHeader>
        <CardContent className="pt-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Zamestnanec</Label>
              <select
                className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={!isAdmin}
              >
                {options.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Dátum</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dochádzka</Label>
              <div className="h-10 rounded-xl border border-zinc-300 px-3 flex items-center justify-between dark:border-slate-700">
                <div className="text-sm">Prítomný</div>
                <Switch checked={form.present} onCheckedChange={(v) => setForm((p) => ({ ...p, present: v }))} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Navolané minúty</Label>
              <Input inputMode="numeric" value={form.minutes} onChange={(e) => setForm((p) => ({ ...p, minutes: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Úspešné hovory</Label>
              <Input
                inputMode="numeric"
                value={form.successful_calls}
                onChange={(e) => setForm((p) => ({ ...p, successful_calls: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Založené účty</Label>
              <Input inputMode="numeric" value={form.accounts} onChange={(e) => setForm((p) => ({ ...p, accounts: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() =>
                onUpsertRecord(selectedUserId, date, {
                  present: !!form.present,
                  minutes: Number(form.minutes) || 0,
                  successful_calls: Number(form.successful_calls) || 0,
                  accounts: Number(form.accounts) || 0,
                })
              }
            >
              Uložiť
            </Button>
            {existing && (
              <Button variant="outline" onClick={() => onDeleteRecord(selectedUserId, date)}>
                Zmazať
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prehľad záznamov</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-slate-800">
            <Table>
              <THead>
                <Tr>
                  <Th>Dátum</Th>
                  <Th>Prítomný</Th>
                  <Th className="text-right">Minúty</Th>
                  <Th className="text-right">Úspešné hovory</Th>
                  <Th className="text-right">Účty</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="text-zinc-600 dark:text-slate-300">
                      Zatiaľ bez záznamov.
                    </Td>
                  </Tr>
                ) : (
                  rows.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-medium">{r.date}</Td>
                      <Td>{r.present ? "Áno" : "Nie"}</Td>
                      <Td className="text-right">{r.minutes}</Td>
                      <Td className="text-right">{r.successful_calls}</Td>
                      <Td className="text-right">{r.accounts}</Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ContactsUI({ isAdmin, profile, profiles, contacts, onUpsertContact, onDeleteContact, initiateCall }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const users = isAdmin ? profiles.filter((p) => p.active) : [profile];

  const visible = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return contacts
      .filter((c) => {
        const okStatus = status === "all" ? true : (c.status || "new") === status;
        const hay = `${c.name || ""} ${c.company || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
        const okQ = !qq ? true : hay.includes(qq);
        return okStatus && okQ;
      })
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  }, [contacts, q, status]);

  const empty = { id: "", name: "", phone: "", email: "", company: "", status: "new", assigned_to_user_id: profile.id, notes: "" };
  const [form, setForm] = useState(empty);

  function openNew() {
    setForm({ ...empty, assigned_to_user_id: isAdmin ? (users[0]?.id || profile.id) : profile.id });
    setDialogOpen(true);
  }
  function openEdit(c) {
    setForm({
      id: c.id,
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      company: c.company || "",
      status: c.status || "new",
      assigned_to_user_id: c.assigned_to_user_id || profile.id,
      notes: c.notes || "",
    });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Kontakty na volanie</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Vyhľadávanie</Label>
              <div className="flex gap-2">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="meno, firma, číslo…" />
                <Button variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">Všetky</option>
                <option value="new">Nové</option>
                <option value="in_progress">Rozpracované</option>
                <option value="called">Zavolané</option>
                <option value="won">Predaj</option>
                <option value="lost">Neúspech</option>
              </select>
            </div>
          </div>

          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Pridať kontakt
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={form.id ? "Upraviť kontakt" : "Nový kontakt"} trigger={null}>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Meno</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Telefón (E.164)</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+421901234567" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Firma</Label>
                  <Input value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <select
                    className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="new">Nové</option>
                    <option value="in_progress">Rozpracované</option>
                    <option value="called">Zavolané</option>
                    <option value="won">Predaj</option>
                    <option value="lost">Neúspech</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Priradiť</Label>
                  <select
                    className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100"
                    value={form.assigned_to_user_id}
                    onChange={(e) => setForm((p) => ({ ...p, assigned_to_user_id: e.target.value }))}
                    disabled={!isAdmin}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Poznámky</Label>
                <textarea
                  className="min-h-[90px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:ring-slate-600"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    onUpsertContact({ ...form });
                    setDialogOpen(false);
                  }}
                >
                  Uložiť
                </Button>
                {form.id && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onDeleteContact(form.id);
                      setDialogOpen(false);
                    }}
                  >
                    Zmazať
                  </Button>
                )}
              </div>
            </div>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zoznam</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-slate-800">
            <Table>
              <THead>
                <Tr>
                  <Th>Meno</Th>
                  <Th>Telefón</Th>
                  <Th>Status</Th>
                  {isAdmin && <Th>Priradené</Th>}
                  <Th className="text-right">Akcie</Th>
                </Tr>
              </THead>
              <TBody>
                {visible.length === 0 ? (
                  <Tr>
                    <Td colSpan={isAdmin ? 5 : 4} className="text-zinc-600 dark:text-slate-300">
                      Žiadne kontakty.
                    </Td>
                  </Tr>
                ) : (
                  visible.map((c) => (
                    <Tr key={c.id}>
                      <Td className="font-medium">
                        <button className="text-left hover:underline" onClick={() => openEdit(c)}>
                          {c.name || "(bez mena)"}
                        </button>
                        {c.company ? <div className="text-xs text-zinc-600 dark:text-slate-300">{c.company}</div> : null}
                      </Td>
                      <Td className="font-mono text-xs">{c.phone || "—"}</Td>
                      <Td>
                        <Badge>{c.status || "new"}</Badge>
                      </Td>
                      {isAdmin && (
                        <Td className="text-sm text-zinc-600 dark:text-slate-300">
                          {users.find((u) => u.id === c.assigned_to_user_id)?.name || "—"}
                        </Td>
                      )}
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button onClick={() => initiateCall(c)} disabled={!c.phone}>
                            <Phone className="h-4 w-4" /> Volaj
                          </Button>
                          <Button variant="outline" onClick={() => openEdit(c)}>
                            Upraviť
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SalaryUI({ isAdmin, profile, profiles, records, settings, monthStart, monthEnd }) {
  const rules = settings?.salary_rules || {
    bonusEnabled: true,
    minutesThreshold: 1200,
    minutesBonus: 50,
    successfulCallsThreshold: 60,
    successfulCallsBonus: 100,
    accountsThreshold: 10,
    accountsBonus: 150,
  };

  const who = isAdmin ? profiles.filter((p) => p.active) : [profile];

  const summaries = useMemo(() => {
    return who.map((u) => {
      const rows = records.filter((r) => r.user_id === u.id);
      const minutes = rows.reduce((a, r) => a + (Number(r.minutes) || 0), 0);
      const successfulCalls = rows.reduce((a, r) => a + (Number(r.successful_calls) || 0), 0);
      const accounts = rows.reduce((a, r) => a + (Number(r.accounts) || 0), 0);
      let bonus = 0;
      if (rules.bonusEnabled) {
        if (minutes >= rules.minutesThreshold) bonus += rules.minutesBonus;
        if (successfulCalls >= rules.successfulCallsThreshold) bonus += rules.successfulCallsBonus;
        if (accounts >= rules.accountsThreshold) bonus += rules.accountsBonus;
      }
      const base = Number(u.base_salary || 0);
      return { id: u.id, name: u.name, base, bonus, total: base + bonus, minutes, successfulCalls, accounts };
    });
  }, [who, records, rules]);

  const totals = useMemo(
    () => ({
      sumTotal: summaries.reduce((a, s) => a + s.total, 0),
      sumBonus: summaries.reduce((a, s) => a + s.bonus, 0),
    }),
    [summaries]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Calculator} label="Výplaty spolu" value={`${totals.sumTotal} €`} />
        <Stat icon={Calculator} label="Bonusy spolu" value={`${totals.sumBonus} €`} />
        <Stat icon={ClipboardList} label="Zamestnanci" value={summaries.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Výplaty</CardTitle>
          <div className="text-sm text-zinc-600 dark:text-slate-300">
            {monthStart} → {monthEnd}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-slate-800">
            <Table>
              <THead>
                <Tr>
                  <Th>Zamestnanec</Th>
                  <Th className="text-right">Základ</Th>
                  <Th className="text-right">Bonus</Th>
                  <Th className="text-right">Spolu</Th>
                </Tr>
              </THead>
              <TBody>
                {summaries.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-medium">{s.name}</Td>
                    <Td className="text-right">{s.base} €</Td>
                    <Td className="text-right">{s.bonus} €</Td>
                    <Td className="text-right font-semibold">{s.total} €</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminUI({ profiles, settings, updateUser, updateSettings }) {
  const cloudtalk = settings?.cloudtalk || { enabled: false, backendUrl: "" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Používatelia</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-slate-800">
            <Table>
              <THead>
                <Tr>
                  <Th>Meno</Th>
                  <Th>Email</Th>
                  <Th>Rola</Th>
                  <Th className="text-right">Základ (€)</Th>
                  <Th className="text-right">agent_id</Th>
                  <Th className="text-right">Aktívny</Th>
                </Tr>
              </THead>
              <TBody>
                {profiles.map((u) => (
                  <Tr key={u.id}>
                    <Td className="font-medium">{u.name}</Td>
                    <Td className="text-zinc-600 dark:text-slate-300">{u.email}</Td>
                    <Td>
                      <select
                        className="h-9 rounded-xl border border-zinc-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100"
                        value={u.role}
                        onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </Td>
                    <Td className="text-right">
                      <Input
                        className="w-[110px] ml-auto"
                        inputMode="numeric"
                        value={u.base_salary}
                        onChange={(e) => updateUser(u.id, { base_salary: Number(e.target.value) || 0 })}
                      />
                    </Td>
                    <Td className="text-right">
                      <Input
                        className="w-[110px] ml-auto"
                        inputMode="numeric"
                        value={u.cloudtalk_agent_id ?? ""}
                        onChange={(e) => updateUser(u.id, { cloudtalk_agent_id: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end">
                        <Switch checked={!!u.active} onCheckedChange={(v) => updateUser(u.id, { active: v })} />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CloudTalk</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <div>
                <div className="text-sm font-medium">Zapnúť CloudTalk</div>
                <div className="text-xs text-zinc-600 dark:text-slate-300">Aktivuje „Volaj“.</div>
              </div>
            </div>
            <Switch checked={!!cloudtalk.enabled} onCheckedChange={(v) => updateSettings({ cloudtalk: { ...cloudtalk, enabled: v } })} />
          </div>
          <div className="space-y-2">
            <Label>Backend URL</Label>
            <Input
              value={cloudtalk.backendUrl || ""}
              onChange={(e) => updateSettings({ cloudtalk: { ...cloudtalk, backendUrl: e.target.value } })}
              placeholder="https://tvoj-backend.example"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
