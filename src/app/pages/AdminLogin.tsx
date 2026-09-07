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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // The exiting page remains mounted during route animations; redirect once.
    if (location.pathname === "/admin/login" && !auth.checking && auth.isAdmin) navigate(next, { replace: true });
  }, [auth.checking, auth.isAdmin, location.pathname, navigate, next]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || auth.checking || auth.authenticated) return;
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

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/admin/login?next=${encodeURIComponent(next)}`,
        },
      });
      if (signInError) throw signInError;
      setMessage("登录链接已发送到邮箱，验证成功后将返回原页面。同一标签页刷新会保持登录。");
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录链接发送失败，请稍后重试。");
    } finally {
      setLoading(false);
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
            使用管理员邮箱接收魔法链接登录，仅管理员角色可管理文章和收藏。
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={`w-full bg-transparent outline-none text-sm ${dm ? "text-white placeholder:text-gray-600" : "text-gray-900 placeholder:text-gray-400"}`}
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${loading
                ? dm
                  ? "bg-white/10 text-gray-500"
                  : "bg-gray-200 text-gray-400"
                : dm
                  ? "bg-indigo-500 text-white hover:bg-indigo-400"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
            >
              {loading ? "发送中..." : "发送登录链接"}
            </button>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
          {message && <p role="status" className="mt-3 text-sm text-emerald-500">{message}</p>}

          <div className={`mt-5 pt-4 border-t text-xs flex items-center gap-2 ${dm ? "border-white/10 text-gray-500" : "border-gray-100 text-gray-400"}`}>
            <Shield size={12} /> 角色来源：`app_metadata.role=admin` 或 `app_metadata.is_admin=true`
          </div>
        </div>
      </div>
    </div>
  );
}
