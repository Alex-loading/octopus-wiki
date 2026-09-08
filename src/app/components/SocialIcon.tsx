import type { LucideIcon } from "lucide-react";

export function SocialIcon({ icon, size = 16 }: { icon: LucideIcon | string; size?: number }) {
  if (typeof icon !== "string") {
    const Icon = icon;
    return <Icon size={size} aria-hidden="true" />;
  }

  // Use the supplied SVG shape while inheriting the link's theme and hover color.
  const mask = `url("${icon}") center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className="block shrink-0"
      style={{ width: size, height: size, backgroundColor: "currentColor", mask, WebkitMask: mask }}
    />
  );
}
