import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Mail, Shield, ArrowLeft } from "lucide-react";
import { getSupabaseClient } from "../content/repository";
import { useAdminAuth } from "../context/AdminAuthContext";
import { safeAdminReturnPath } from "../auth/adminSession";

interface AdminLoginProps {
  darkMode: boolean;
}

export function AdminLogin({ darkMode }: AdminLoginProps) {
  const dm = darkMode;
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAdminAuth();
  const next = safeAdminReturnPath(new URLSearchParams(location.search).get("next"));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeEntry, setCodeEntry] = useState(false);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const loading = busy !== null;
  const [resendAt, setResendAt] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submitDisabled = loading || (!codeEntry && resendSeconds > 0);

  useEffect(() => {
    // The exiting page remains mounted during route animations; redirect once.
    if (location.pathname === "/admin/login" && !auth.checking && auth.isAdmin) navigate(next, { replace: true });
  }, [auth.checking, auth.isAdmin, location.pathname, navigate, next]);

  useEffect(() => {
    if (auth.authenticated && !auth.checking) { setCode(""); setMessage(""); }
  }, [auth.authenticated, auth.checking]);

  useEffect(() => {
    if (!resendAt) return;
    const update = () => setResendSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  const sendCode = async () => {
    if (loading || auth.checking || auth.authenticated || Date.now() < resendAt) return;
    setError("");
    setMessage("");

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase 未配置，无法登录后台。");
      return;
    }

    if (!email.trim()) {
      setError("请输入邮箱地址。");
      return;
    }

    setBusy("send");
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/admin/login?next=${encodeURIComponent(next)}`,
        },
      });
      if (signInError) throw signInError;
      setEmail(email.trim());
      setCode("");
      setCodeEntry(true);
      setResendAt(Date.now() + 60_000);
      setMessage("验证码已发送到邮箱。请复制验证码，回到当前应用输入；也可使用邮件中的登录链接。");
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录邮件发送失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!codeEntry) { await sendCode(); return; }
    if (loading || auth.checking || auth.authenticated) return;
    setError("");
    setMessage("");
    const token = code.replace(/\s/g, "");
    if (!email.trim() || !/^[0-9]{6,10}$/.test(token)) {
      setError("请输入邮箱及邮件中的完整数字验证码。");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) { setError("Supabase 未配置，无法登录后台。"); return; }
    setBusy("verify");
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("未能建立登录会话，请重新发送验证码。");
      setCode("");
      // The shared provider verifies the user with Supabase before allowing navigation.
      setMessage("验证码已验证，正在确认管理员权限…");
    } catch {
      setError("验证失败：请检查验证码是否正确、过期或已使用，也可检查网络后重试或重新发送。");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`min-h-screen pt-24 pb-16 ${dm ? "bg-gray-950" : "bg-white"}`}>
      <div className="max-w-xl mx-auto px-6">
        <button
          onClick={() => navigate("/")}
          className={`text-sm mb-6 inline-flex items-center gap-2 ${dm ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
        >
          <ArrowLeft size={14} /> 返回首页
        </button>

        <div className={`rounded-2xl border p-6 ${dm ? "bg-gray-900 border-white/10" : "bg-white border-gray-200 shadow-sm"}`}>
          <p className={`text-sm mb-2 ${dm ? "text-indigo-400" : "text-indigo-600"}`}>管理后台</p>
          <h1 className={`text-2xl font-light mb-3 ${dm ? "text-white" : "text-gray-900"}`}>管理员登录</h1>
          <p className={`text-sm mb-6 ${dm ? "text-gray-400" : "text-gray-500"}`}>
            使用管理员邮箱接收验证码，在当前应用内完成登录。仅管理员可管理文章和收藏。
          </p>

          {auth.checking && <p role="status" className="mb-4 text-sm text-gray-500">正在确认登录状态...</p>}
          {!auth.checking && auth.authenticated && !auth.isAdmin && (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-rose-500">当前账号不是管理员，请切换管理员账号。</p>
              <button type="button" className="text-sm underline" onClick={async () => {
                setError("");
                try { await auth.signOut(); }
                catch (error) { setError(error instanceof Error ? error.message : "退出失败，请重试。"); }
              }}>退出当前账号</button>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4" hidden={auth.checking || auth.authenticated}>
            <label className="block">
              <span className={`text-xs mb-1.5 block ${dm ? "text-gray-400" : "text-gray-500"}`}>邮箱</span>
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${dm ? "border-white/10 bg-gray-950" : "border-gray-200 bg-gray-50"}`}>
                <Mail size={14} className={dm ? "text-gray-500" : "text-gray-400"} />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  readOnly={codeEntry || loading}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={`w-full bg-transparent outline-none text-sm ${dm ? "text-white placeholder:text-gray-600" : "text-gray-900 placeholder:text-gray-400"}`}
                />
              </div>
            </label>

            {codeEntry && (
              <label className="block">
                <span className={`text-xs mb-1.5 block ${dm ? "text-gray-400" : "text-gray-500"}`}>邮件验证码</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  readOnly={loading}
                  required
                  pattern="[0-9]{6,10}"
                  maxLength={10}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\s/g, ""))}
                  placeholder="输入邮件中的数字验证码"
                  className={`w-full rounded-xl border px-3 py-2.5 outline-none text-sm ${dm ? "border-white/10 bg-gray-950 text-white" : "border-gray-200 bg-gray-50 text-gray-900"}`}
                />
              </label>
            )}

            <button
              type="submit"
              disabled={submitDisabled}
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${submitDisabled
                ? dm
                  ? "bg-white/10 text-gray-500"
                  : "bg-gray-200 text-gray-400"
                : dm
                  ? "bg-indigo-500 text-white hover:bg-indigo-400"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
            >
              {busy === "verify" ? "验证中…" : busy === "send" ? "发送中…" : codeEntry ? "验证并登录" : resendSeconds > 0 ? `${resendSeconds} 秒后可重新发送` : "发送验证码"}
            </button>
            {codeEntry ? (
              <div className="flex items-center justify-between text-sm">
                <button type="button" disabled={loading || resendSeconds > 0} className="text-indigo-500 disabled:text-gray-400" onClick={sendCode}>
                  {resendSeconds > 0 ? `${resendSeconds} 秒后可重新发送` : "重新发送验证码"}
                </button>
                <button type="button" disabled={loading} className="text-gray-500 underline" onClick={() => { setCodeEntry(false); setCode(""); setError(""); setMessage(""); }}>修改邮箱</button>
              </div>
            ) : (
              <button type="button" disabled={loading} className="text-sm text-indigo-500" onClick={() => {
                if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("请先填写接收验证码的邮箱。"); return; }
                setError(""); setMessage(""); setCodeEntry(true);
              }}>已有验证码，直接输入</button>
            )}
            <p className={`text-xs leading-relaxed ${dm ? "text-gray-400" : "text-gray-500"}`}>
              手机安装版请从邮箱复制验证码后切回本应用，无需打开邮件链接。登录后返回快捷收藏设置，点击「启用 90 天免登录收藏」。
            </p>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
          {message && <p role="status" className="mt-3 text-sm text-emerald-500">{message}</p>}

          <div className={`mt-5 pt-4 border-t text-xs flex items-center gap-2 ${dm ? "border-white/10 text-gray-500" : "border-gray-100 text-gray-400"}`}>
            <Shield size={12} /> 通过管理员身份校验后才可进入后台。
          </div>
        </div>
      </div>
    </div>
  );
}
