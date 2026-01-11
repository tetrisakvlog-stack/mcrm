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
  Check,
  X,
  Image as ImageIcon,
  Pencil,
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
  listContactCalls,
  createContactCall,
  getSettings,
  updateSettings,
  // alias/avatar requests
  createProfileChangeRequest,
  listMyProfileChangeRequests,
  listPendingProfileChangeRequests,
  reviewProfileChangeRequest,
  uploadAvatarFile,
} from "./lib/db.js";

/** =========================
 *  Remember login toggle key
 *  ========================= */
const REMEMBER_KEY = "mcrm_remember_login";

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
function isWeekday(d) {
  const day = d.getDay(); // 0 Sun ... 6 Sat
  return day >= 1 && day <= 5;
}
function countWorkdaysBetween(fromISO, toISO) {
  const from = new Date(fromISO + "T00:00:00");
  const to = new Date(toISO + "T00:00:00");
  let n = 0;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    if (isWeekday(d)) n++;
  }
  return n;
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function safeStr(v) {
  return (v ?? "").toString();
}

/** =========================
 *  Branding: Flame + MCRM
 *  ========================= */
function FlameMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="block">
      <path
        d="M36.8 6.4c1.7 8.6-2.6 13.6-8.1 19.8-4.2 4.7-8.9 9.9-8.9 18.7 0 9.3 7.3 16.7 16.3 16.7 10.6 0 19.1-8.8 19.1-20.6 0-12.7-7.5-20-13.3-25.7-1.9-1.9-3.6-3.6-5.1-5.9z"
        fill="#e11d48"
      />
      <path
        d="M33.6 25.3c1.0 5.0-1.5 7.9-4.6 11.3-2.4 2.7-5.2 5.8-5.2 10.9 0 5.4 4.2 9.7 9.5 9.7 6.2 0 11.1-5.1 11.1-12.0 0-7.4-4.4-11.6-7.8-15.0-1.1-1.1-2.1-2.1-3.0-3.4z"
        fill="#fb7185"
        opacity="0.9"
      />
    </svg>
  );
}

function BrandLockup({ className = "", size = 34, textClassName = "" }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <FlameMark size={size} />
      <div className={`mt-1 text-lg font-extrabold tracking-[0.18em] text-zinc-900 ${textClassName}`}>MCRM</div>
    </div>
  );
}

function Avatar({ url, name, size = 40 }) {
  const initials = (name || "U").trim().slice(0, 1).toUpperCase();
  return (
    <div
      className="rounded-2xl border border-zinc-200 bg-white overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
      title={name || ""}
    >
      {url ? (
        <img src={url} alt={name || "avatar"} className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center justify-center">
          <FlameMark size={Math.max(18, Math.floor(size * 0.55))} />
          <div className="text-[10px] font-bold tracking-[0.18em] text-zinc-900 -mt-1">{initials}</div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-zinc-100 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-zinc-600">{label}</div>
          <div className="text-xl font-semibold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });

  const [rememberLogin, setRememberLogin] = useState(() => {
    try {
      const v = localStorage.getItem(REMEMBER_KEY);
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });

  const isAdmin = profile?.role === "admin";
  const displayName = useMemo(() => profile?.alias || profile?.name || "User", [profile?.alias, profile?.name]);

  const [periodISO, setPeriodISO] = useState(() => todayISO());
  const monthStart = useMemo(() => startOfMonthISO(periodISO), [periodISO]);
  const monthEnd = useMemo(() => endOfMonthISO(periodISO), [periodISO]);

  const [profiles, setProfiles] = useState([]);
  const [records, setRecords] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState(null);

  // profile change requests
  const [myRequests, setMyRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(REMEMBER_KEY, rememberLogin ? "1" : "0");
    } catch {
      // ignore
    }
  }, [rememberLogin]);

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
      setMyRequests([]);
      setPendingRequests([]);
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

        try {
          const mine = await listMyProfileChangeRequests(u.id);
          if (!cancelled) setMyRequests(mine);
        } catch (e) {
          // ignore
        }
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
        if (cancelled) return;
        setProfiles(p);

        try {
          const pending = await listPendingProfileChangeRequests();
          if (!cancelled) setPendingRequests(pending);
        } catch {
          // ignore
        }
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

    try {
      localStorage.setItem(REMEMBER_KEY, rememberLogin ? "1" : "0");
    } catch {}

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return toast.error(error.message);
  }

  async function register() {
    const name = authForm.name.trim();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    if (!name) return toast.error("Zadaj meno.");

    try {
      localStorage.setItem(REMEMBER_KEY, rememberLogin ? "1" : "0");
    } catch {}

    const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return toast.error(error.message);
    toast.success("Registrácia OK. Ak máš zapnutý email confirm, potvrď email.");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function refreshRequests() {
    if (!profile?.id) return;
    try {
      const mine = await listMyProfileChangeRequests(profile.id);
      setMyRequests(mine);
    } catch {
      // ignore
    }
    if (isAdmin) {
      try {
        const pending = await listPendingProfileChangeRequests();
        setPendingRequests(pending);
      } catch {
        // ignore
      }
    }
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
      setProfile(await getMyProfile(profile.id));
      await refreshRequests();
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  async function requestAliasChange(alias) {
    if (!profile?.id) return;
    const clean = safeStr(alias).trim();
    if (!clean) return toast.error("Zadaj alias.");
    if (clean.length > 32) return toast.error("Alias je príliš dlhý (max 32).");

    try {
      await createProfileChangeRequest({ userId: profile.id, kind: "alias", payload: { alias: clean } });
      toast.success("Žiadosť o alias odoslaná (čaká na schválenie adminom).");
      await refreshRequests();
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  async function requestAvatarChange(file) {
    if (!profile?.id) return;
    if (!file) return toast.error("Vyber obrázok.");
    if (!file.type?.startsWith("image/")) return toast.error("Súbor musí byť obrázok.");

    try {
      const url = await uploadAvatarFile({ userId: profile.id, file });
      await createProfileChangeRequest({ userId: profile.id, kind: "avatar", payload: { avatar_url: url } });
      toast.success("Žiadosť o avatar odoslaná (čaká na schválenie adminom).");
      await refreshRequests();
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  async function adminReviewRequest(requestId, approve, note) {
    if (!profile?.id) return;
    try {
      await reviewProfileChangeRequest({ requestId, approve, note, adminUserId: profile.id });
      toast.success(approve ? "Schválené." : "Zamietnuté.");
      await refreshData();
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

  if (missingEnv) {
    return (
      <div className="min-h-screen p-6">
        <Card>
          <CardHeader>
            <CardTitle>mcrm – chýbajú ENV premenné</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-700">
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
      <div className="min-h-screen p-6">
        <div className="text-sm text-zinc-600">Načítavam…</div>
        <Toaster position="top-right" />
      </div>
    );
  }

  if (!session?.user?.id || !profile) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant={authMode === "login" ? "primary" : "outline"}
                  className="w-[130px]"
                  onClick={() => setAuthMode("login")}
                >
                  Prihlásiť
                </Button>

                <BrandLockup size={34} />

                <Button
                  variant={authMode === "register" ? "primary" : "outline"}
                  className="w-[130px]"
                  onClick={() => setAuthMode("register")}
                >
                  Registrovať
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
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
                  placeholder="meno@email.sk"
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

              <div className="h-10 rounded-xl border border-zinc-300 px-3 flex items-center justify-between">
                <div className="text-sm text-zinc-700">Zapamätať prihlásenie</div>
                <Switch checked={rememberLogin} onCheckedChange={(v) => setRememberLogin(!!v)} />
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
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <Avatar url={profile.avatar_url || null} name={displayName} size={40} />

            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-semibold truncate">{displayName}</div>
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
              <div className="text-xs text-zinc-500 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <FlameMark size={14} />
                  <span className="font-bold tracking-[0.18em] text-zinc-900">MCRM</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
          displayName={displayName}
          isAdmin={isAdmin}
          profiles={profiles}
          monthStart={monthStart}
          monthEnd={monthEnd}
          records={records}
          contacts={contacts}
          settings={settings}
          refreshData={refreshData}
          myRequests={myRequests}
          pendingRequests={pendingRequests}
          requestAliasChange={requestAliasChange}
          requestAvatarChange={requestAvatarChange}
          adminReviewRequest={adminReviewRequest}
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
      <div className="text-sm text-zinc-600">
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
  displayName,
  isAdmin,
  profiles,
  monthStart,
  monthEnd,
  records,
  contacts,
  settings,
  refreshData,
  myRequests,
  pendingRequests,
  requestAliasChange,
  requestAvatarChange,
  adminReviewRequest,
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
        <MyProfile
          profile={profile}
          displayName={displayName}
          records={records}
          monthStart={monthStart}
          monthEnd={monthEnd}
          isAdmin={isAdmin}
          myRequests={myRequests}
          requestAliasChange={requestAliasChange}
          requestAvatarChange={requestAvatarChange}
        />
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
          <AdminUI
            profiles={profiles}
            settings={settings}
            pendingRequests={pendingRequests}
            updateUser={updateUser}
            updateSettings={updateSettings}
            adminReviewRequest={adminReviewRequest}
          />
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-zinc-600">Nemáš admin oprávnenie.</CardContent>
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

function MyProfile({ profile, displayName, records, monthStart, monthEnd, isAdmin, myRequests, requestAliasChange, requestAvatarChange }) {
  const [showEmail, setShowEmail] = useState(false);
  const [aliasDraft, setAliasDraft] = useState("");

  const myRows = useMemo(() => (records || []).filter((r) => r.user_id === profile.id), [records, profile.id]);
  const presentDays = useMemo(() => myRows.filter((r) => !!r.present).length, [myRows]);
  const workdaysInMonth = useMemo(() => countWorkdaysBetween(monthStart, monthEnd), [monthStart, monthEnd]);

  const currentPay = useMemo(() => {
    const base = Number(profile.base_salary || 0);
    if (!base || !workdaysInMonth) return 0;
    const ratio = presentDays / workdaysInMonth;
    return round2(base * ratio);
  }, [profile.base_salary, presentDays, workdaysInMonth]);

  const advances = Number(profile.advances || 0);
  const payAfterAdvances = useMemo(() => round2(currentPay - advances), [currentPay, advances]);

  const pendingMine = useMemo(() => (myRequests || []).filter((r) => r.status === "pending"), [myRequests]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Profil</CardTitle>
          <div className="flex items-center gap-2">
            <Avatar url={profile.avatar_url || null} name={displayName} size={40} />
          </div>
        </CardHeader>

        <CardContent className="pt-2 space-y-3">
          <Row label="Zobrazené meno" value={displayName} />

          {isAdmin && profile.alias ? <Row label="Skutočné meno" value={profile.name} /> : null}

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-zinc-600">Email</div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium font-mono">{showEmail ? profile.email : "****@****"}</div>
              <Button variant="ghost" className="h-8 px-3 rounded-xl" onClick={() => setShowEmail((v) => !v)}>
                {showEmail ? "Skryť" : "Zobraziť"}
              </Button>
            </div>
          </div>

          <Row label="Rola" value={profile.role} />
          <Row label="CloudTalk agent_id" value={profile.cloudtalk_agent_id ?? "—"} />

          {isAdmin ? <Row label="Základná mzda" value={`${Number(profile.base_salary || 0)} €`} /> : null}

          <div className="pt-3 border-t border-zinc-100 space-y-2">
            <Row label="Odchodené dni / pracovné dni" value={`${presentDays} / ${workdaysInMonth}`} />
            <Row label="Aktuálna výplata podľa dochádzky" value={`${currentPay} €`} />
            <Row label="Zálohy" value={`${advances} €`} />
            <Row label="Výplata po zálohách" value={`${payAfterAdvances} €`} />
            <div className="text-xs text-zinc-600">
              Počíta sa: základná mzda / pracovné dni v mesiaci × odchodené dni.
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <div className="text-sm font-semibold">Alias & Avatar (schvaľuje admin)</div>

            <div className="grid gap-2">
              <Label>Požiadať o zmenu aliasu</Label>
              <div className="flex gap-2">
                <Input value={aliasDraft} onChange={(e) => setAliasDraft(e.target.value)} placeholder="napr. patres" />
                <Button onClick={() => requestAliasChange(aliasDraft)}>
                  <Pencil className="h-4 w-4" /> Odoslať
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Požiadať o zmenu avatara</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) requestAvatarChange(f);
                    e.target.value = "";
                  }}
                />
                <div className="text-xs text-zinc-600 inline-flex items-center gap-1">
                  <ImageIcon className="h-4 w-4" /> obrázok (png/jpg/webp)
                </div>
              </div>
            </div>

            {pendingMine.length ? (
              <div className="rounded-xl border border-zinc-200 p-3">
                <div className="text-sm font-medium">Čakajúce žiadosti</div>
                <div className="mt-2 space-y-1 text-xs text-zinc-600">
                  {pendingMine.slice(0, 5).map((r) => (
                    <div key={r.id}>
                      • {r.kind} – {new Date(r.created_at).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500">Žiadne čakajúce žiadosti.</div>
            )}

            {!isAdmin ? <div className="text-xs text-zinc-500">SIP údaje sú interné (spravuje admin).</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Info</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-2 text-sm text-zinc-700">
          <div>Pracovné dni: pondelok–piatok.</div>
          <div>Pracovný čas: 09:00–18:00.</div>
          <div className="text-xs text-zinc-600">
            Ak sa používateľ neprihlási a nevyplní dochádzku, admin to po 18:00 musí potvrdiť v systéme (panel v Dochádzka & KPI).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-zinc-600">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

/** =========================
 *  Admin quick attendance confirm (no DB schema changes)
 *  ========================= */
function AdminMissingAttendancePanel({ profiles, records, onConfirm }) {
  const now = new Date();
  const after18 = now.getHours() >= 18;
  const weekday = isWeekday(now);
  const dayISO = todayISO();

  const missing = useMemo(() => {
    if (!after18 || !weekday) return [];
    const actives = (profiles || []).filter((p) => !!p.active);
    return actives.filter((u) => !records.some((r) => r.user_id === u.id && r.date === dayISO));
  }, [after18, weekday, profiles, records, dayISO]);

  const [reasonById, setReasonById] = useState({});

  useEffect(() => {
    if (missing.length === 0) return;
    setReasonById((prev) => {
      const next = { ...prev };
      for (const u of missing) {
        if (!next[u.id]) next[u.id] = "Neprihlásený";
      }
      return next;
    });
  }, [missing]);

  if (!after18 || !weekday) return null;
  if (missing.length === 0) return null;

  const reasons = ["Neprihlásený", "Dovolenka", "PN", "OČR", "Služobne", "Iné"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chýbajúca dochádzka dnes</CardTitle>
        <div className="text-sm text-zinc-600">
          Je po 18:00 a chýba záznam pre: <span className="font-medium text-zinc-900">{missing.length}</span> používateľov.
        </div>
      </CardHeader>
      <CardContent className="pt-2 space-y-3">
        <div className="text-xs text-zinc-600">Dôvod je iba informačný v rozhraní (neukladá sa), aby sa nemenila databáza.</div>

        <div className="space-y-2">
          {missing.map((u) => (
            <div key={u.id} className="rounded-xl border border-zinc-200 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.alias || u.name}</div>
                  <div className="text-xs text-zinc-600 truncate">{u.email}</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                    value={reasonById[u.id] || "Neprihlásený"}
                    onChange={(e) => setReasonById((p) => ({ ...p, [u.id]: e.target.value }))}
                  >
                    {reasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <Button onClick={() => onConfirm(u.id, true, reasonById[u.id] || "Neprihlásený")}>Prítomný</Button>
                    <Button variant="outline" onClick={() => onConfirm(u.id, false, reasonById[u.id] || "Neprihlásený")}>
                      Neprítomný
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecordsUI({ isAdmin, profile, profiles, records, monthStart, monthEnd, onUpsertRecord, onDeleteRecord }) {
  const [selectedUserId, setSelectedUserId] = useState(profile.id);
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState({ present: false, minutes: 0, successful_calls: 0, accounts: 0 });

  const today = todayISO();

  useEffect(() => {
    if (!isAdmin && date !== today) setDate(today);
  }, [isAdmin, date, today]);

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

  async function confirmMissing(userId, present, reason) {
    const dayISO = todayISO();
    try {
      await onUpsertRecord(userId, dayISO, {
        present: !!present,
        minutes: 0,
        successful_calls: 0,
        accounts: 0,
      });
      toast.success(`Dochádzka potvrdená (${present ? "prítomný" : "neprítomný"}). Dôvod: ${reason}`);
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin ? <AdminMissingAttendancePanel profiles={profiles} records={records} onConfirm={confirmMissing} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Záznam dňa</CardTitle>
          <div className="text-sm text-zinc-600">Obdobie {monthStart} → {monthEnd}</div>
        </CardHeader>
        <CardContent className="pt-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Zamestnanec</Label>
              <select
                className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={!isAdmin}
              >
                {options.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.alias || u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Dátum</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!isAdmin} />
              {!isAdmin ? <div className="text-xs text-zinc-500">User vie zapisovať iba dnešný deň.</div> : null}
            </div>

            <div className="space-y-2">
              <Label>Dochádzka</Label>
              <div className="h-10 rounded-xl border border-zinc-300 px-3 flex items-center justify-between">
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

            {existing && isAdmin ? (
              <Button variant="outline" onClick={() => onDeleteRecord(selectedUserId, date)}>
                Zmazať
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prehľad záznamov</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-auto rounded-xl border border-zinc-200">
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
                    <Td colSpan={5} className="text-zinc-600">
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

/** =========================
 *  CONTACTS (upgraded)
 *  ========================= */
function toLocalDateTimeInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalDateTimeInput(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function labelStatus(s) {
  const v = (s || "new").toLowerCase();
  if (v === "won") return "Získaný";
  if (v === "lost") return "Nezáujem";
  if (v === "called") return "Aktívny";
  if (v === "in_progress") return "Rozpracované";
  return "Nové";
}

function ContactsUI({ isAdmin, profile, profiles, contacts, onUpsertContact, onDeleteContact, initiateCall }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const [userFilter, setUserFilter] = useState(isAdmin ? "all" : profile.id);
  const [showUninterested, setShowUninterested] = useState(false);

  const [view, setView] = useState("list"); // list | calendar
  const [dialogOpen, setDialogOpen] = useState(false);

  const empty = {
    id: "",
    name: "",
    phone: "",
    email: "",
    company: "",
    status: "new",
    assigned_to_user_id: profile.id,
    notes: "",
    client_potential: "mid",
    employment_status: "",
    sales_experience: "",
    next_call_at: null,
  };
  const [form, setForm] = useState(empty);

  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(() => (contacts || []).find((c) => c.id === selectedId) || null, [contacts, selectedId]);

  const users = useMemo(() => (isAdmin ? (profiles || []).filter((p) => p.active) : [profile]), [isAdmin, profiles, profile]);

  const visible = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return (contacts || [])
      .filter((c) => {
        if (isAdmin && userFilter !== "all" && (c.assigned_to_user_id || "") !== userFilter) return false;

        const cst = (c.status || "new").toLowerCase();
        if (status !== "all" && cst !== status) return false;

        if (!showUninterested && status !== "lost" && cst === "lost") return false;

        const hay = `${c.name || ""} ${c.company || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
        if (qq && !hay.includes(qq)) return false;

        return true;
      })
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  }, [contacts, q, status, isAdmin, userFilter, showUninterested]);

  useEffect(() => {
    if (!visible.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visible.some((c) => c.id === selectedId)) {
      setSelectedId(visible[0].id);
    }
  }, [visible, selectedId]);

  function openNew() {
    setForm({
      ...empty,
      assigned_to_user_id: isAdmin ? users[0]?.id || profile.id : profile.id,
    });
    setDialogOpen(true);
  }
  function openEdit(c) {
    setForm({
      id: c.id,
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      company: c.company || "",
      status: (c.status || "new").toLowerCase(),
      assigned_to_user_id: c.assigned_to_user_id || profile.id,
      notes: c.notes || "",
      client_potential: c.client_potential || "mid",
      employment_status: c.employment_status || "",
      sales_experience: c.sales_experience || "",
      next_call_at: c.next_call_at || null,
    });
    setDialogOpen(true);
  }

  const [calls, setCalls] = useState([]);
  const [callForm, setCallForm] = useState({
    outcome: "connected",
    attitude: "",
    employment_status: "",
    sales_experience: "",
    client_potential: "mid",
    next_call_at: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selected?.id) {
        setCalls([]);
        return;
      }
      try {
        const rows = await listContactCalls(selected.id);
        if (!cancelled) setCalls(rows);

        if (!cancelled) {
          setCallForm((p) => ({
            ...p,
            employment_status: selected.employment_status || "",
            sales_experience: selected.sales_experience || "",
            client_potential: selected.client_potential || "mid",
            next_call_at: toLocalDateTimeInput(selected.next_call_at || null),
          }));
        }
      } catch (e) {
        toast.error(String(e?.message || e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  async function setContactStatus(nextStatus) {
    if (!selected) return;
    const patch = { ...selected, status: nextStatus };
    if (nextStatus === "lost") patch.next_call_at = null;

    try {
      await onUpsertContact(patch);
      toast.success("Uložené.");
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  async function savePostojAndLog() {
    if (!selected?.id) return;

    const statusNow = (selected.status || "new").toLowerCase();
    const isLost = statusNow === "lost";

    const nextCallISO = isLost ? null : fromLocalDateTimeInput(callForm.next_call_at);

    try {
      await createContactCall({
        contactId: selected.id,
        userId: profile.id,
        outcome: callForm.outcome,
        attitude: callForm.attitude,
        notes: callForm.notes,
      });

      await onUpsertContact({
        ...selected,
        last_outcome: callForm.outcome || null,
        last_attitude: callForm.attitude || null,
        last_notes: callForm.notes || null,
        employment_status: callForm.employment_status || null,
        sales_experience: callForm.sales_experience || null,
        client_potential: callForm.client_potential || null,
        next_call_at: nextCallISO,
      });

      toast.success("Uložené + log pridaný.");

      const rows = await listContactCalls(selected.id);
      setCalls(rows);

      setCallForm((p) => ({ ...p, notes: "" }));
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  const calendarItems = useMemo(() => {
    const items = (contacts || [])
      .filter((c) => !!c.next_call_at && (c.status || "new").toLowerCase() !== "lost")
      .filter((c) => (!isAdmin || userFilter === "all" ? true : (c.assigned_to_user_id || "") === userFilter))
      .sort((a, b) => new Date(a.next_call_at).getTime() - new Date(b.next_call_at).getTime());

    const groups = new Map();
    for (const c of items) {
      const d = new Date(c.next_call_at);
      const key = d.toISOString().slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    return Array.from(groups.entries()).map(([day, list]) => ({ day, list }));
  }, [contacts, isAdmin, userFilter]);

  useEffect(() => {
    const KEY = `mcrm_notified_${profile.id}`;
    const readNotified = () => {
      try {
        return JSON.parse(localStorage.getItem(KEY) || "{}");
      } catch {
        return {};
      }
    };
    const writeNotified = (obj) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(obj));
      } catch {}
    };

    const tick = () => {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      const now = Date.now();
      const horizonMs = 10 * 60 * 1000; // 10 min
      const notified = readNotified();

      const relevant = (contacts || [])
        .filter((c) => !!c.next_call_at && (c.status || "new").toLowerCase() !== "lost")
        .filter((c) => (!isAdmin || userFilter === "all" ? true : (c.assigned_to_user_id || "") === userFilter));

      for (const c of relevant) {
        const t = new Date(c.next_call_at).getTime();
        if (!Number.isFinite(t)) continue;

        const delta = t - now;
        if (delta <= 0 || delta > horizonMs) continue;

        const stamp = `${c.id}_${c.next_call_at}`;
        if (notified[stamp]) continue;

        notified[stamp] = true;

        const title = "Dohoda: je čas volať";
        const body = `${c.name || "(bez mena)"} • ${c.phone || ""} • ${toLocalDateTimeInput(c.next_call_at).replace("T", " ")}`;
        try {
          new Notification(title, { body });
        } catch {}
      }

      writeNotified(notified);
    };

    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, [contacts, profile.id, isAdmin, userFilter]);

  async function enableNotifications() {
    if (!("Notification" in window)) return toast.error("Prehliadač nepodporuje notifikácie.");
    try {
      const res = await Notification.requestPermission();
      if (res === "granted") toast.success("Upozornenia zapnuté.");
      else toast.error("Upozornenia neboli povolené.");
    } catch (e) {
      toast.error(String(e?.message || e));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Kontakty</CardTitle>
          <div className="flex gap-2">
            <Button variant={view === "list" ? "primary" : "outline"} onClick={() => setView("list")}>
              Zoznam
            </Button>
            <Button variant={view === "calendar" ? "primary" : "outline"} onClick={() => setView("calendar")}>
              Kalendár
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-2 space-y-4">
          <div className="space-y-2">
            <Label>Vyhľadávanie</Label>
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="meno, firma, číslo…" />
              <Button variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">Všetky</option>
                <option value="new">Nové</option>
                <option value="in_progress">Rozpracované</option>
                <option value="called">Aktívny</option>
                <option value="won">Získaný</option>
                <option value="lost">Nezáujem</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Používateľ</Label>
              <div className="flex gap-2">
                <select
                  className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                  value={isAdmin ? userFilter : profile.id}
                  onChange={(e) => setUserFilter(e.target.value)}
                  disabled={!isAdmin}
                >
                  {isAdmin && <option value="all">Všetky</option>}
                  {(users || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.alias || u.name} ({u.email})
                    </option>
                  ))}
                </select>
                {isAdmin ? (
                  <Button variant="outline" onClick={() => setUserFilter(profile.id)}>
                    Moje
                  </Button>
                ) : null}
              </div>
              {!isAdmin ? <div className="text-xs text-zinc-500">User vidí iba svoje.</div> : null}
            </div>

            <div className="space-y-2">
              <Label>Zobrazenie nezáujmu</Label>
              <div className="h-10 rounded-xl border border-zinc-300 px-3 flex items-center justify-between">
                <div className="text-sm text-zinc-700">{showUninterested ? "Zap." : "Vyp."}</div>
                <Switch checked={showUninterested} onCheckedChange={(v) => setShowUninterested(!!v)} />
              </div>
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
                  <Label>Potenciál klienta</Label>
                  <select
                    className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                    value={form.client_potential || "mid"}
                    onChange={(e) => setForm((p) => ({ ...p, client_potential: e.target.value }))}
                  >
                    <option value="high">Vysoký</option>
                    <option value="mid">Stredný</option>
                    <option value="low">Nízky</option>
                    <option value="very_low">Veľmi nízky</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Status</Label>
                  <select
                    className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="new">Nové</option>
                    <option value="in_progress">Rozpracované</option>
                    <option value="called">Aktívny</option>
                    <option value="won">Získaný</option>
                    <option value="lost">Nezáujem</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Priradiť</Label>
                  <select
                    className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                    value={form.assigned_to_user_id}
                    onChange={(e) => setForm((p) => ({ ...p, assigned_to_user_id: e.target.value }))}
                    disabled={!isAdmin}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.alias || u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Poznámky</Label>
                  <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
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

                {form.id ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onDeleteContact(form.id);
                      setDialogOpen(false);
                    }}
                  >
                    Zmazať
                  </Button>
                ) : null}
              </div>
            </div>
          </Dialog>

          {view === "calendar" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-700 font-medium">Dohody</div>
                <Button variant="outline" onClick={enableNotifications}>
                  Zapnúť upozornenia
                </Button>
              </div>

              {calendarItems.length === 0 ? (
                <div className="text-sm text-zinc-600">Žiadne dohodnuté hovory.</div>
              ) : (
                <div className="space-y-3">
                  {calendarItems.map((g) => (
                    <div key={g.day} className="rounded-xl border border-zinc-200 p-3">
                      <div className="text-sm font-semibold">{g.day}</div>
                      <div className="mt-2 space-y-2">
                        {g.list.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-2">
                            <button className="text-left hover:underline min-w-0" onClick={() => setSelectedId(c.id)}>
                              <div className="font-medium truncate">{c.name || "(bez mena)"}</div>
                              <div className="text-xs text-zinc-600 truncate">
                                {toLocalDateTimeInput(c.next_call_at).replace("T", " ")} • {c.phone || "—"}
                              </div>
                            </button>
                            <Button onClick={() => initiateCall(c)} disabled={!c.phone}>
                              <Phone className="h-4 w-4" /> Volaj
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {visible.length === 0 ? (
                <div className="text-sm text-zinc-600">Žiadne kontakty.</div>
              ) : (
                visible.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left rounded-2xl border p-3 hover:bg-zinc-50 ${
                      c.id === selectedId ? "border-zinc-400" : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold truncate">{c.name || "(bez mena)"}</div>
                      <div className="text-xs text-zinc-600">{labelStatus(c.status)}</div>
                    </div>
                    <div className="text-xs text-zinc-600 truncate">
                      {(c.company || "—")} • {(c.phone || "—")}
                    </div>
                    {c.next_call_at && (c.status || "new").toLowerCase() !== "lost" ? (
                      <div className="mt-1 text-xs text-zinc-700">
                        Dohoda: <span className="font-medium">{toLocalDateTimeInput(c.next_call_at).replace("T", " ")}</span>
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detail kontaktu</CardTitle>
        </CardHeader>

        <CardContent className="pt-2 space-y-4">
          {!selected ? (
            <div className="text-sm text-zinc-600">Vyber kontakt.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold truncate">{selected.name || "(bez mena)"}</div>
                  <div className="text-sm text-zinc-600 truncate">
                    {(selected.company || "—")} • {(selected.email || "—")}
                  </div>
                  <div className="text-sm font-mono">{selected.phone || "—"}</div>
                  <div className="mt-2 inline-flex">
                    <Badge>{labelStatus(selected.status)}</Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => initiateCall(selected)} disabled={!selected.phone}>
                    <Phone className="h-4 w-4" /> Volaj
                  </Button>
                  <Button variant="outline" onClick={() => openEdit(selected)}>
                    Upraviť
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Button variant="outline" onClick={() => setContactStatus("called")}>
                  Označiť: Aktívny
                </Button>
                <Button variant="outline" onClick={() => setContactStatus("won")}>
                  Označiť: Získaný
                </Button>
                <Button variant="outline" onClick={() => setContactStatus("lost")}>
                  Označiť: Nemá záujem
                </Button>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4 space-y-3">
                <div className="text-sm font-semibold">Stav hovoru / Postoj / Dohoda</div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Stav hovoru</Label>
                    <select
                      className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                      value={callForm.outcome}
                      onChange={(e) => setCallForm((p) => ({ ...p, outcome: e.target.value }))}
                    >
                      <option value="connected">Pripojené</option>
                      <option value="no_answer">Nezdvihol</option>
                      <option value="busy">Obsadené</option>
                      <option value="rejected">Zrušené</option>
                      <option value="other">Iné</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Postoj kontaktu</Label>
                    <select
                      className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                      value={callForm.attitude}
                      onChange={(e) => setCallForm((p) => ({ ...p, attitude: e.target.value }))}
                    >
                      <option value="">—</option>
                      <option value="call_later_no_time">Zavolať neskôr (nemá čas)</option>
                      <option value="already_customer">Už klient (nemá záujem)</option>
                      <option value="no_interest">Nemá záujem</option>
                      <option value="interrupted">Prerušené (vyťažené)</option>
                      <option value="blacklist">Žiadosť o čiernu listinu</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Zamestnanecký status</Label>
                    <select
                      className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                      value={callForm.employment_status}
                      onChange={(e) => setCallForm((p) => ({ ...p, employment_status: e.target.value }))}
                    >
                      <option value="">—</option>
                      <option value="employed">Zamestnaný</option>
                      <option value="student">Študent</option>
                      <option value="business">Podnikateľ</option>
                      <option value="unemployed">Nezamestnaný</option>
                      <option value="other">Iné</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Skúsenosti s obchodovaním</Label>
                    <select
                      className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                      value={callForm.sales_experience}
                      onChange={(e) => setCallForm((p) => ({ ...p, sales_experience: e.target.value }))}
                    >
                      <option value="">—</option>
                      <option value="yes">Áno</option>
                      <option value="no">Nie</option>
                      <option value="unknown">Nie je dostupné</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Potenciál klienta</Label>
                    <select
                      className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                      value={callForm.client_potential}
                      onChange={(e) => setCallForm((p) => ({ ...p, client_potential: e.target.value }))}
                    >
                      <option value="high">Vysoký</option>
                      <option value="mid">Stredný</option>
                      <option value="low">Nízky</option>
                      <option value="very_low">Veľmi nízky</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Dohoda (dátum a čas ďalšieho hovoru)</Label>
                    <Input
                      type="datetime-local"
                      value={callForm.next_call_at}
                      onChange={(e) => setCallForm((p) => ({ ...p, next_call_at: e.target.value }))}
                      disabled={(selected.status || "new").toLowerCase() === "lost"}
                    />
                    {(selected.status || "new").toLowerCase() === "lost" ? (
                      <div className="text-xs text-zinc-500">Kontakt je „Nemá záujem“ — dohoda sa nenastavuje.</div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Poznámky k hovoru</Label>
                    <textarea
                      className="min-h-[90px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                      value={callForm.notes}
                      onChange={(e) => setCallForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="čo povedal, čo dohodnuté, kedy zavolať..."
                    />
                  </div>
                </div>

                <Button onClick={savePostojAndLog} className="w-fit">
                  Uložiť postoj + log
                </Button>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">História hovorov</div>
                  <div className="text-xs text-zinc-600">{calls.length} záznamov</div>
                </div>

                {calls.length === 0 ? (
                  <div className="mt-2 text-sm text-zinc-600">Zatiaľ bez záznamov.</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {calls.slice(0, 20).map((r) => (
                      <div key={r.id} className="rounded-xl border border-zinc-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-2 flex-wrap">
                            {r.outcome ? <Badge>{r.outcome}</Badge> : null}
                            {r.attitude ? <Badge>{r.attitude}</Badge> : null}
                          </div>
                          <div className="text-xs text-zinc-600">{new Date(r.created_at).toLocaleString()}</div>
                        </div>
                        {r.notes ? <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{r.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
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
      return { id: u.id, name: u.alias || u.name, base, bonus, total: base + bonus, minutes, successfulCalls, accounts };
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
          <div className="text-sm text-zinc-600">
            {monthStart} → {monthEnd}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-auto rounded-xl border border-zinc-200">
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

function AdminUI({ profiles, settings, pendingRequests, updateUser, updateSettings, adminReviewRequest }) {
  const cloudtalk = settings?.cloudtalk || { enabled: false, backendUrl: "" };

  const [sipOpen, setSipOpen] = useState(false);
  const [sipUser, setSipUser] = useState(null);
  const [sipForm, setSipForm] = useState({ username: "", password: "", domain: "" });

  function openSip(u) {
    setSipUser(u);
    setSipForm({
      username: u.sip_username || "",
      password: u.sip_password || "",
      domain: u.sip_domain || "",
    });
    setSipOpen(true);
  }

  async function saveSip() {
    if (!sipUser?.id) return;
    await updateUser(sipUser.id, {
      sip_username: sipForm.username,
      sip_password: sipForm.password,
      sip_domain: sipForm.domain,
    });
    setSipOpen(false);
  }

  const pending = pendingRequests || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Žiadosti o zmeny profilu (alias/avatar)</CardTitle>
          <div className="text-sm text-zinc-600">Schvaľuješ zmeny ako admin. Po schválení sa upraví profil.</div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-auto rounded-xl border border-zinc-200">
            <Table>
              <THead>
                <Tr>
                  <Th>Používateľ</Th>
                  <Th>Typ</Th>
                  <Th>Hodnota</Th>
                  <Th>Dátum</Th>
                  <Th className="text-right">Akcie</Th>
                </Tr>
              </THead>
              <TBody>
                {pending.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="text-zinc-600">
                      Žiadne čakajúce žiadosti.
                    </Td>
                  </Tr>
                ) : (
                  pending.map((r) => {
                    const u = profiles.find((p) => p.id === r.user_id);
                    const who = u ? u.alias || u.name : r.user_id;
                    const val =
                      r.kind === "alias"
                        ? safeStr(r.payload?.alias)
                        : r.kind === "avatar"
                        ? safeStr(r.payload?.avatar_url)
                        : JSON.stringify(r.payload || {});
                    return (
                      <Tr key={r.id}>
                        <Td className="font-medium">{who}</Td>
                        <Td>{r.kind}</Td>
                        <Td className="max-w-[280px]">
                          {r.kind === "avatar" && val ? (
                            <div className="flex items-center gap-2">
                              <img src={val} alt="avatar" className="h-10 w-10 rounded-2xl object-cover border border-zinc-200" />
                              <div className="text-xs text-zinc-600 truncate">{val}</div>
                            </div>
                          ) : (
                            <div className="text-sm">{val || "—"}</div>
                          )}
                        </Td>
                        <Td className="text-xs text-zinc-600">{new Date(r.created_at).toLocaleString()}</Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button onClick={() => adminReviewRequest(r.id, true, "")}>
                              <Check className="h-4 w-4" /> Schváliť
                            </Button>
                            <Button variant="outline" onClick={() => adminReviewRequest(r.id, false, "")}>
                              <X className="h-4 w-4" /> Zamietnuť
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Používatelia</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-auto rounded-xl border border-zinc-200">
            <Table>
              <THead>
                <Tr>
                  <Th>Avatar</Th>
                  <Th>Meno/Alias</Th>
                  <Th>Email</Th>
                  <Th>Rola</Th>
                  <Th className="text-right">Základ (€)</Th>
                  <Th className="text-right">agent_id</Th>
                  <Th className="text-right">SIP</Th>
                  <Th className="text-right">Aktívny</Th>
                </Tr>
              </THead>
              <TBody>
                {profiles.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <Avatar url={u.avatar_url || null} name={u.alias || u.name} size={36} />
                    </Td>
                    <Td className="font-medium">{u.alias || u.name}</Td>
                    <Td className="text-zinc-600">{u.email}</Td>
                    <Td>
                      <select
                        className="h-9 rounded-xl border border-zinc-300 bg-white px-2 text-sm"
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
                      <Button variant="outline" onClick={() => openSip(u)}>
                        SIP
                      </Button>
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

          <Dialog open={sipOpen} onOpenChange={setSipOpen} title={sipUser ? `SIP – ${sipUser.alias || sipUser.name}` : "SIP"} trigger={null}>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>SIP Username</Label>
                <Input value={sipForm.username} onChange={(e) => setSipForm((p) => ({ ...p, username: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>SIP Password</Label>
                <Input type="password" value={sipForm.password} onChange={(e) => setSipForm((p) => ({ ...p, password: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>SIP Domain</Label>
                <Input value={sipForm.domain} onChange={(e) => setSipForm((p) => ({ ...p, domain: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveSip}>Uložiť</Button>
                <Button variant="outline" onClick={() => setSipOpen(false)}>
                  Zrušiť
                </Button>
              </div>
            </div>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CloudTalk</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <div>
                <div className="text-sm font-medium">Zapnúť CloudTalk</div>
                <div className="text-xs text-zinc-600">Aktivuje „Volaj“.</div>
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
