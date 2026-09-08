import { Mail } from "lucide-react";

export const PROFILE = {
  name: "Octopus",
  email: "2290176755@qq.com",
  portrait: "/images/octopus-portrait.png",
} as const;

export const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/Alex-loading", icon: "/icons/social/github.svg" },
  { label: "小红书", href: "https://www.xiaohongshu.com/user/profile/60fcc8d00000000001004295", icon: "/icons/social/xiaohongshu.svg" },
  { label: "网易云音乐", href: "https://y.music.163.com/m/user?id=1712951859", icon: "/icons/social/netease-music.svg" },
  { label: "Steam", href: "https://steamcommunity.com/profiles/76561199185364610/", icon: "/icons/social/steam.svg" },
  { label: "邮件", href: `mailto:${PROFILE.email}`, icon: Mail },
] as const;
