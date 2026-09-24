import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import TopAccentBar from "../components/layout/TopAccentBar";

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      const message =
        err?.response?.data?.errors?.email?.[0] ||
        err?.response?.data?.message ||
        "Email atau password salah.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 relative overflow-hidden">
      <TopAccentBar />
      {/* Dekorasi background lembut */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-100/50 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-red-100/40 blur-3xl" />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="h-1.5 w-full flex">
          <div className="h-full w-1/3 bg-idm-blue" />
          <div className="h-full w-1/3 bg-idm-red" />
          <div className="h-full w-1/3 bg-idm-yellow" />
        </div>
        <div className="p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="h-11 px-3.5 bg-white border-2 border-idm-blue rounded-lg shadow-sm flex items-center justify-center relative overflow-hidden mb-4">
              <div className="absolute top-0 left-0 right-0 h-1 bg-idm-red" />
              <span className="font-extrabold tracking-tight text-[18px] italic text-idm-blue">
                Indo<span className="text-idm-red">maret</span>
              </span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-idm-yellow" />
            </div>
            <h1 className="text-headline-md text-on-surface tracking-tight">Dashboard Indomaret</h1>
            <p className="text-body-sm text-text-muted mt-1 text-center">
              Monitoring pengeluaran barang &amp; pendapatan gerai harian
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">Email</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl focus-within:bg-white focus-within:border-idm-blue transition-colors">
                <span className="material-symbols-outlined text-idm-blue text-[18px]">mail</span>
                <input
                  className="w-full bg-transparent text-sm font-medium text-on-surface outline-none border-none p-0 focus:ring-0"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="manager@indomaret-dashboard.test"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">Password</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl focus-within:bg-white focus-within:border-idm-blue transition-colors">
                <span className="material-symbols-outlined text-text-muted text-[18px]">lock</span>
                <input
                  className="w-full bg-transparent text-sm font-medium text-on-surface outline-none border-none p-0 focus:ring-0"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-text-muted hover:text-on-surface"
                  aria-label="Tampilkan password"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 h-11 rounded-xl bg-idm-blue hover:bg-idm-blue-dark text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">login</span>
              )}
              Masuk
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
