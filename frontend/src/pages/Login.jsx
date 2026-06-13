import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, User, Lock, ArrowRight } from "lucide-react";
import HEXA_LOGO from "../assets/images/logo.png";
import useAuthStore from "../store/authStore";

// ─── Canvas background (unchanged) ───────────────────────────────────────────
function CanvasBg() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, points = [], target = { x: 0, y: 0 }, rafId, lastT = null;
    const tweens = [];
    function tweenTo(obj, dur, props) {
      const s = {}, e = {};
      for (const k in props) { if (k === "cb") continue; s[k] = obj[k]; e[k] = props[k]; }
      tweens.push({ obj, s, e, dur: dur * 1000, el: 0, cb: props.cb });
    }
    function tickTweens(dt) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const t = tweens[i]; t.el += dt;
        const p = Math.min(t.el / t.dur, 1);
        const ease = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
        for (const k in t.s) t.obj[k] = t.s[k] + (t.e[k] - t.s[k]) * ease;
        if (p >= 1) { tweens.splice(i, 1); if (t.cb) t.cb(); }
      }
    }
    function dist(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; }
    class Circle {
      constructor(pos, r) { this.pos = pos; this.r = r; this.active = 0; }
      draw() {
        if (!this.active) return;
        ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(156,217,249,${this.active})`; ctx.fill();
      }
    }
    function shift(p) {
      tweenTo(p, 1 + Math.random(), { x: p.ox - 50 + Math.random() * 100, y: p.oy - 50 + Math.random() * 100, cb: () => shift(p) });
    }
    function init() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
      target = { x: W / 2, y: H / 2 };
      tweens.length = 0; points = [];
      for (let x = 0; x < W; x += W / 20) {
        for (let y = 0; y < H; y += H / 20) {
          const px = x + Math.random() * (W / 20), py = y + Math.random() * (H / 20);
          points.push({ x: px, ox: px, y: py, oy: py, active: 0 });
        }
      }
      for (let i = 0; i < points.length; i++) {
        const p = points[i], cl = [];
        for (let j = 0; j < points.length; j++) {
          const q = points[j]; if (p === q) continue;
          let placed = false;
          for (let k = 0; k < 5; k++) if (!placed && cl[k] == null) { cl[k] = q; placed = true; }
          for (let k = 0; k < 5; k++) if (!placed && dist(p, q) < dist(p, cl[k])) { cl[k] = q; placed = true; }
        }
        p.closest = cl; p.circle = new Circle(p, 2 + Math.random() * 2);
      }
      for (const p of points) shift(p);
    }
    function loop(ts) {
      const dt = lastT ? ts - lastT : 16; lastT = ts;
      tickTweens(dt); ctx.clearRect(0, 0, W, H);
      for (const p of points) {
        const d = dist(target, p);
        if (d < 10000) { p.active = 0.5; p.circle.active = 0.9; }
        else if (d < 40000) { p.active = 0.25; p.circle.active = 0.5; }
        else if (d < 100000) { p.active = 0.08; p.circle.active = 0.2; }
        else { p.active = 0; p.circle.active = 0; }
        if (p.active) {
          for (const nb of p.closest) {
            if (!nb) continue;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nb.x, nb.y);
            ctx.strokeStyle = `rgba(156,217,249,${p.active})`; ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
        p.circle.draw();
      }
      rafId = requestAnimationFrame(loop);
    }
    const onMouseMove = (e) => { target.x = e.pageX; target.y = e.pageY; };
    const onResize = () => { cancelAnimationFrame(rafId); lastT = null; init(); rafId = requestAnimationFrame(loop); };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);
    init(); rafId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafId); window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("resize", onResize); };
  }, []);
  return (
    <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, display: "block", background: "#080808" }} />
  );
}

// ─── Login page ───────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, isLoading, error, clearError } = useAuthStore();

  const [role, setRole]       = useState("employee");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [localError, setLocalError] = useState("");

  // Already logged in → redirect
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Sync store error to local
  useEffect(() => {
    if (error) { setLocalError(error); clearError(); }
  }, [error, clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    const result = await login({ username: username.trim(), password });
    if (result.success) {
      const actualRole = result.user?.role;
      const isAdminRole = actualRole === "admin" || actualRole === "manager";

      // Role-tab mismatch guard
      if (role === "admin" && !isAdminRole) {
        useAuthStore.getState().logout?.();
        setLocalError("Access denied. Please use the Employee login.");
        return;
      }
      if (role === "employee" && isAdminRole) {
        useAuthStore.getState().logout?.();
        setLocalError("Please use the Admin login for admin accounts.");
        return;
      }

      const dest = isAdminRole ? "/admin" : "/dashboard";
      navigate(dest, { replace: true });
    }
  };

  const isAdmin = role === "admin";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080808; }
        .lg-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: 'Sora', sans-serif; position: relative; z-index: 1; }
        .lg-card { position: relative; z-index: 10; width: 100%; max-width: 440px; background: rgba(113,99,99,0); backdrop-filter: blur(32px) saturate(1.2); -webkit-backdrop-filter: blur(32px) saturate(1.2); border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; padding: 16px 40px 32px; box-shadow: 0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.15) inset; animation: cardIn 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes cardIn { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .lg-logo-area { display: flex; flex-direction: column; align-items: center; margin-bottom: -40px; }
        .lg-logo-img { width: 200px; height: 200px; object-fit: contain; filter: brightness(0) invert(1); animation: logoIn 0.6s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
        @keyframes logoIn { from { opacity: 0; transform: scale(0.8) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .lg-divider { height: 1px; background: linear-gradient(to right, transparent, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.12) 70%, transparent); margin-bottom: 4px; }
        .lg-heading { text-align: center; margin-bottom: 16px; }
        .lg-heading h1 { font-size: 22px; font-weight: 600; color: #fff; letter-spacing: -0.01em; margin-bottom: 6px; }
        .lg-heading p { font-size: 13px; font-weight: 400; color: rgba(255,255,255,0.4); }
        .lg-toggle { display: flex; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 4px; gap: 3px; margin-bottom: 22px; }
        .lg-role-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 0; border-radius: 9px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.4); background: transparent; border: none; cursor: pointer; transition: all 0.2s ease; font-family: 'Sora', sans-serif; }
        .lg-role-btn:hover:not(.lg-role-active) { color: rgba(255,255,255,0.75); }
        .lg-role-active { background: rgba(255,255,255,0.14) !important; color: #fff !important; font-weight: 600 !important; box-shadow: 0 1px 6px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08); }
        .lg-form { display: flex; flex-direction: column; gap: 14px; }
        .lg-field { display: flex; flex-direction: column; gap: 7px; }
        .lg-field label { font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,0.5); letter-spacing: 0.08em; text-transform: uppercase; }
        .lg-input-wrap { position: relative; display: flex; align-items: center; }
        .lg-input-icon { position: absolute; left: 14px; color: rgba(255,255,255,0.3); pointer-events: none; transition: color 0.18s; }
        .lg-input-wrap:focus-within .lg-input-icon { color: rgba(255,255,255,0.8); }
        .lg-input-wrap input { width: 100%; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 11px; padding: 12px 44px 12px 42px; font-size: 14px; font-family: 'Sora', sans-serif; font-weight: 400; color: #fff; outline: none; transition: border-color 0.18s, background 0.18s, box-shadow 0.18s; }
        .lg-input-wrap input::placeholder { color: rgba(255,255,255,0.2); }
        .lg-input-wrap input:focus { border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); box-shadow: 0 0 0 3px rgba(255,255,255,0.06); }
        .lg-eye-btn { position: absolute; right: 14px; background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.3); display: flex; align-items: center; padding: 0; transition: color 0.18s; }
        .lg-eye-btn:hover { color: rgba(255,255,255,0.8); }
        .lg-error { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; font-size: 13px; border-radius: 10px; padding: 11px 14px; text-align: center; font-weight: 500; }
        .lg-submit { margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; padding: 13px; background: #fff; color: #080808; font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700; border: none; border-radius: 11px; cursor: pointer; transition: background 0.18s, transform 0.15s, box-shadow 0.18s, opacity 0.18s; letter-spacing: 0.02em; }
        .lg-submit:hover:not(:disabled) { background: #f0f0f0; transform: translateY(-1px); box-shadow: 0 12px 32px rgba(255,255,255,0.2); }
        .lg-submit:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
        .lg-submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .lg-spinner { width: 17px; height: 17px; border: 2px solid rgba(0,0,0,0.2); border-top-color: #000; border-radius: 50%; animation: lgSpin 0.65s linear infinite; }
        @keyframes lgSpin { to { transform: rotate(360deg); } }
        .lg-footer { margin-top: 22px; text-align: center; font-size: 11px; font-weight: 400; color: rgba(255,255,255,0.22); letter-spacing: 0.04em; }
        @media (max-width: 500px) { .lg-card { padding: 30px 22px 26px; border-radius: 18px; max-width: 100%; } .lg-heading h1 { font-size: 19px; } }
      `}</style>

      <CanvasBg />

      <div className="lg-root">
        <div className="lg-card">
          <div className="lg-logo-area">
            <img src={HEXA_LOGO} alt="Hexa Branding" className="lg-logo-img" />
          </div>
          <div className="lg-divider" />
          <div className="lg-heading">
            <h1>{isAdmin ? "Admin Portal" : "Welcome Back"}</h1>
            <p>{isAdmin ? "Sign in to manage your team" : "Sign in to your account"}</p>
          </div>

          <div className="lg-toggle">
            <button type="button" onClick={() => { setRole("employee"); setLocalError(""); }} className={`lg-role-btn${role === "employee" ? " lg-role-active" : ""}`}>
              <User size={14} /> Employee
            </button>
            <button type="button" onClick={() => { setRole("admin"); setLocalError(""); }} className={`lg-role-btn${role === "admin" ? " lg-role-active" : ""}`}>
              <ShieldCheck size={14} /> Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="lg-form">
            <div className="lg-field">
              <label htmlFor="lg-user">Username</label>
              <div className="lg-input-wrap">
                <User size={15} className="lg-input-icon" />
                <input id="lg-user" type="text" placeholder={isAdmin ? "admin" : "your.username"} value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
              </div>
            </div>
            <div className="lg-field">
              <label htmlFor="lg-pass">Password</label>
              <div className="lg-input-wrap">
                <Lock size={15} className="lg-input-icon" />
                <input id="lg-pass" type={showPass ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                <button type="button" className="lg-eye-btn" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {localError && <div className="lg-error">{localError}</div>}
            <button type="submit" className="lg-submit" disabled={isLoading}>
              {isLoading ? <span className="lg-spinner" /> : <> Sign In <ArrowRight size={16} /> </>}
            </button>
          </form>

          <p className="lg-footer">© {new Date().getFullYear()} Hexa Branding · All rights reserved</p>
        </div>
      </div>
    </>
  );
}