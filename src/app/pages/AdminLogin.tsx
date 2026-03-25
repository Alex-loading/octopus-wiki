import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Mail, Shield, ArrowLeft } from "lucide-react";
import { getSupabaseClient, getUserRoleState } from "../content/repository";

interface AdminLoginProps {
  darkMode: boolean;
}

export function AdminLogin({ darkMode }: AdminLoginProps) {
  const dm = darkMode;
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      const roleState = await getUserRoleState();
      if (roleState.authenticated && roleState.isAdmin) {
        navigate("/admin/articles", { replace: true });
      }
    };
    void init();
  }, [navigate]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
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
    const next = new URLSearchParams(location.search).get("next") || "/admin/articles";

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${next}`,
      },
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("登录链接已发送到邮箱，请完成验证后返回后台。");
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
            使用管理员邮箱接收魔法链接登录，仅管理员角色可访问文章管理页面。
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
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

            {error && <p className="text-sm text-rose-500">{error}</p>}
            {message && <p className="text-sm text-emerald-500">{message}</p>}

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

          <div className={`mt-5 pt-4 border-t text-xs flex items-center gap-2 ${dm ? "border-white/10 text-gray-500" : "border-gray-100 text-gray-400"}`}>
            <Shield size={12} /> 角色来源：`app_metadata.role=admin` 或 `app_metadata.is_admin=true`
          </div>
        </div>
      </div>
    </div>
  );
}
