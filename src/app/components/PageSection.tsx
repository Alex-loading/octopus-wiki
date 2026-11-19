import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export function PageSection({ darkMode, className = "", children }: {
  darkMode: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main data-theme={darkMode ? "dark" : "light"}
      className={`min-h-screen pt-24 pb-20 ${darkMode ? "bg-gray-950" : "bg-white"} ${className}`}>
      <div className="max-w-5xl mx-auto px-6">{children}</div>
    </main>
  );
}

export function PageIntro({ darkMode, icon: Icon, label, title, description, action, children }: {
  darkMode: boolean;
  icon: LucideIcon;
  label: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mb-12"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className={`mb-3 flex items-center gap-2 text-sm font-medium ${darkMode ? "text-indigo-400" : "text-indigo-600"}`}>
            <motion.span aria-hidden="true" className="inline-flex shrink-0"
              animate={{ rotate: reduceMotion ? 0 : [0, 15, -15, 0] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, repeatDelay: 2 }}>
              <Icon size={15} />
            </motion.span>
            {label}
          </div>
          <h1 className={`mb-3 text-4xl font-light tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>{title}</h1>
          {description && <p className={darkMode ? "text-gray-400" : "text-gray-500"}>{description}</p>}
        </div>
        {action && <div className="shrink-0 sm:mt-8">{action}</div>}
      </div>
      {children}
    </motion.header>
  );
}
