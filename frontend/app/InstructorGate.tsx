"use client";

import {FormEvent, ReactNode, useEffect, useState} from "react";
import {api, json} from "./lib/api";

type InstructorAuth = {authenticated: boolean; username: string; role: string};

export default function InstructorGate({children}: {children: ReactNode}) {
  const [auth, setAuth] = useState<InstructorAuth | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api<InstructorAuth>("/api/auth/me").catch(() => null),
      api<{configured: boolean}>("/api/auth/status").catch(() => ({configured: false})),
    ]).then(([current, status]) => {
      if (!active) return;
      setAuth(current);
      setConfigured(status.configured);
      setChecking(false);
    });
    return () => { active = false; };
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const result = await api<InstructorAuth>("/api/auth/login", json({username, password}));
      setAuth(result);
      setPassword("");
    } catch (e: any) {
      setError(e.message || "Sign-in failed.");
    } finally {
      setWorking(false);
    }
  }

  async function signOut() {
    try { await api("/api/auth/logout", {method: "POST"}); }
    finally { setAuth(null); }
  }

  if (checking) return <main className="centerpage"><section className="mobilebox"><div className="loading">Checking instructor session…</div></section></main>;

  if (!auth) return <main className="centerpage"><section className="mobilebox">
    <div className="eyebrow">NEXUS · INSTRUCTOR ACCESS</div>
    <h1>Sign in to the classroom console</h1>
    <p className="muted">Enrollment, group management, attendance, and review tools are restricted to instructors.</p>
    {!configured && <div className="warning" style={{marginTop: 14}}>Instructor access is not configured yet. Add <code>INSTRUCTOR_USERNAME</code> and a strong <code>INSTRUCTOR_PASSWORD</code> to <code>backend/.env</code>, then restart the backend.</div>}
    <form onSubmit={signIn}>
      <div className="field" style={{marginTop: 16}}><label>INSTRUCTOR USERNAME</label><input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></div>
      <div className="field" style={{marginTop: 13}}><label>PASSWORD</label><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
      {error && <div className="error">{error}</div>}
      <button className="btn" style={{width: "100%", marginTop: 14}} disabled={working || !configured}>{working ? "Signing in…" : "Instructor sign in"}</button>
    </form>
    <div className="footerhint">Use a unique password with at least 12 characters, uppercase and lowercase letters, a number, and a symbol.</div>
  </section></main>;

  return <>{children}<div style={{position:"fixed",right:14,bottom:14,zIndex:30,display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,background:"#10253e",color:"#e9f1f7",boxShadow:"0 8px 25px #07132133",fontSize:11}}><span>Signed in · {auth.username} ({auth.role})</span><button onClick={signOut} className="btn secondary small">Sign out</button></div></>;
}
