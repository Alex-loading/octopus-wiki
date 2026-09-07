import React, { useId } from "react";
import { AUTHOR_AVATARS, AUTHOR_NAME_MAX_LENGTH, resolveAuthorName, resolveAuthorAvatar } from "../content/articleAuthor";
import { OctopusAvatar } from "./OctopusAvatar";

export function ArticleAuthorFields({ name, avatarId, darkMode: dm, onNameChange, onAvatarChange }: {
  name: string;
  avatarId: string;
  darkMode: boolean;
  onNameChange: (name: string) => void;
  onAvatarChange: (id: string) => void;
}) {
  const fieldId = useId();
  const helpId = `${fieldId}-help`;
  return (
    <fieldset className={`rounded-xl border p-3 space-y-3 min-w-0 ${dm ? "border-white/10" : "border-gray-200"}`}>
      <legend className={`px-1 text-xs ${dm ? "text-gray-400" : "text-gray-500"}`}>这篇文章的我</legend>
      <label className="block">
        <span className={`block text-xs mb-1 ${dm ? "text-gray-400" : "text-gray-500"}`}>作者签名（可选）</span>
        <input value={name} onChange={event => onNameChange(event.target.value)}
          placeholder="例如：摸鱼中的 Octopus" aria-describedby={helpId}
          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${dm ? "bg-gray-950 border-white/10 text-white placeholder:text-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"}`} />
        <span id={helpId} className={`block mt-1 text-xs ${Array.from(name.trim()).length > AUTHOR_NAME_MAX_LENGTH ? "text-rose-500" : "text-gray-500"}`}>
          留空显示 Octopus；最多 {AUTHOR_NAME_MAX_LENGTH} 字，按输入原样展示。
        </span>
      </label>
      <fieldset>
        <legend className={`text-xs mb-2 ${dm ? "text-gray-400" : "text-gray-500"}`}>选一只今天的章鱼</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
          {AUTHOR_AVATARS.map(avatar => (
            <label key={avatar.id} className="relative cursor-pointer min-w-0">
              <input type="radio" name={`${fieldId}-avatar`} value={avatar.id}
                checked={resolveAuthorAvatar(avatarId).id === avatar.id}
                onChange={() => onAvatarChange(avatar.id)} className="peer sr-only" />
              <span className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 peer-focus-visible:ring-offset-2 peer-checked:border-indigo-400 ${dm ? "border-white/10 text-gray-400 hover:bg-white/5 peer-checked:bg-indigo-500/10 peer-checked:text-indigo-300" : "border-gray-200 text-gray-500 hover:bg-gray-50 peer-checked:bg-indigo-50 peer-checked:text-indigo-700"}`}>
                <OctopusAvatar avatarId={avatar.id} className="w-10 h-10" />
                <span className="text-xs">{avatar.label}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={`flex items-center gap-3 rounded-xl p-3 ${dm ? "bg-gray-950" : "bg-gray-50"}`}>
        <OctopusAvatar avatarId={avatarId} />
        <div className="min-w-0">
          <p className={`text-sm font-medium break-words ${dm ? "text-white" : "text-gray-900"}`}>{resolveAuthorName(name)}</p>
          <p className="text-xs text-gray-500 mt-0.5">文章署名预览 · 仅用于这篇文章</p>
        </div>
      </div>
    </fieldset>
  );
}
