import React from "react";
import { resolveAuthorAvatar } from "../content/articleAuthor";

/** Original pixel artwork on a 32 × 32 grid; no remote image dependency. */
export function OctopusAvatar({ avatarId, className = "w-10 h-10", administrator = false }: {
  avatarId?: string;
  className?: string;
  administrator?: boolean;
}) {
  const avatar = resolveAuthorAvatar(avatarId);
  return (
    <svg viewBox="0 0 32 32" width="40" height="40" className={`shrink-0 rounded-xl ${className}`}
      role="img" aria-label={administrator ? "管理员章鱼头像" : `${avatar.label}章鱼头像`} shapeRendering="crispEdges">
      <rect width="32" height="32" fill={avatar.background} />
      <g fill={avatar.body}>
        <path d="M12 7h8v2h3v3h2v8h-2v3h-2v-2h-2v3h-2v-3h-2v3h-2v-3h-2v2H9v-3H7v-8h2V9h3z" />
        <path d="M7 19H5v6h4v-2H7zm18 0h2v6h-4v-2h2zM9 23h2v4H7v-2h2zm14 0h-2v4h4v-2h-2zM13 24h2v4h-4v-2h2zm6 0h-2v4h4v-2h-2z" />
      </g>
      <path d="M12 9h7v1h-7zm-2 2h2v2h-2z" fill="#FFFFFF" opacity=".22" />
      <g fill="#34312E">
        {avatar.id === "chill" ? <path d="M9 14h6v4h-5v-2H9zm8 0h6v2h-1v2h-5zm-2 1h2v1h-2z" />
          : avatar.id === "sleepy" ? <path d="M10 16h4v1h-4zm8 0h4v1h-4zm-5-1h1v1h-1zm5 0h1v1h-1z" />
          : avatar.id === "happy" ? <path d="M10 15h1v-1h2v1h1v2h-1v-1h-2v1h-1zm8 0h1v-1h2v1h1v2h-1v-1h-2v1h-1z" />
          : <path d="M11 14h2v3h-2zm8 0h2v3h-2z" />}
        {avatar.id === "focused" && <path fillRule="evenodd" d="M9 13h6v6H9zm1 1v4h4v-4zm7-1h6v6h-6zm1 1v4h4v-4zm-3 1h2v1h-2z" />}
        {avatar.id === "happy" ? <path d="M14 19h4v2h-1v1h-2v-1h-1z" />
          : avatar.id === "sleepy" ? <rect x="15" y="19" width="2" height="2" />
          : <path d="M14 19h1v1h2v-1h1v2h-4z" />}
      </g>
      {avatar.id === "sleepy" && <path d="M24 5h5v1h-1v1h-1v1h2v1h-5V8h1V7h1V6h-2z" fill="#736083" />}
      {avatar.id === "inspired" && <path d="M26 3h1v3h3v1h-3v3h-1V7h-3V6h3zM5 9h1v2h2v1H6v2H5v-2H3v-1h2z" fill="#BF842C" />}
      {avatar.id === "happy" && <path d="M9 18h3v1H9zm11 0h3v1h-3z" fill="#EAB0A0" />}
      {administrator && <g data-admin-crown="true">
        <path d="M10 3h2v2h2V2h4v3h2V3h2v6H10z" fill="#7C5528" />
        <path d="M11 4h1v2h3V3h2v3h3V4h1v4H11z" fill="#E7B95D" />
        <path d="M11 7h10v1H11z" fill="#F9DFA0" />
      </g>}
    </svg>
  );
}
