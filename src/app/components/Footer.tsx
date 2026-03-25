import { Link } from "react-router";
import { motion } from "motion/react";
import { Feather, Github, Twitter, Mail, Rss } from "lucide-react";

interface FooterProps {
  darkMode: boolean;
}

export function Footer({ darkMode }: FooterProps) {
  const dm = darkMode;

  return (
    <footer className={`border-t py-12 ${dm ? "border-white/5 bg-gray-950" : "border-gray-100 bg-white"}`}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dm ? "bg-indigo-500" : "bg-indigo-600"}`}>
              <Feather size={14} className="text-white" />
            </div>
            <span className={`text-sm ${dm ? "text-gray-400" : "text-gray-500"}`}>
              陈默的个人博客
            </span>
          </Link>

          <div className="flex items-center gap-5">
            {[
              { href: "#", icon: Github },
              { href: "#", icon: Twitter },
              { href: "#", icon: Mail },
              { href: "#", icon: Rss },
            ].map(({ href, icon: Icon }, i) => (
              <motion.a
                key={i}
                href={href}
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.9 }}
                className={`transition-colors ${dm ? "text-gray-600 hover:text-gray-300" : "text-gray-400 hover:text-gray-700"}`}
              >
                <Icon size={16} />
              </motion.a>
            ))}
          </div>

          <div className={`flex items-center gap-4 text-xs ${dm ? "text-gray-600" : "text-gray-400"}`}>
            <Link to="/" className={`hover:${dm ? "text-gray-300" : "text-gray-700"} transition-colors`}>首页</Link>
            <Link to="/blog" className={`hover:${dm ? "text-gray-300" : "text-gray-700"} transition-colors`}>文章</Link>
            <Link to="/about" className={`hover:${dm ? "text-gray-300" : "text-gray-700"} transition-colors`}>关于</Link>
          </div>
        </div>

        <div className={`mt-8 pt-6 border-t text-center text-xs ${dm ? "border-white/5 text-gray-700" : "border-gray-100 text-gray-400"}`}>
          © {new Date().getFullYear()} 陈默. 用 ❤️ 和代码构建。
        </div>
      </div>
    </footer>
  );
}
