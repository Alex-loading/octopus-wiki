import React, { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

interface CommentDeleteButtonProps {
  isAdmin: boolean;
  darkMode: boolean;
  onDelete: () => Promise<void>;
}

export function CommentDeleteButton({ isAdmin, darkMode, onDelete }: CommentDeleteButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);

  if (!isAdmin) return null;

  const handleDelete = async () => {
    if (pendingRef.current || !window.confirm("确认删除这条评论？删除后无法恢复。")) return;

    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      await onDelete();
    } catch (error) {
      setError(error instanceof Error ? error.message : "删除失败，请稍后重试。");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-label="删除评论"
        disabled={pending}
        onClick={handleDelete}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors disabled:cursor-wait disabled:opacity-50 ${darkMode
          ? "text-gray-500 hover:bg-rose-500/10 hover:text-rose-400"
          : "text-gray-400 hover:bg-rose-50 hover:text-rose-600"
          }`}
      >
        <Trash2 size={12} aria-hidden="true" />
        {pending ? "删除中..." : "删除"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}
