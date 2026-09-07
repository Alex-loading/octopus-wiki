export const DEFAULT_AUTHOR_NAME = "Octopus";
export const DEFAULT_AUTHOR_AVATAR = "everyday";
export const AUTHOR_NAME_MAX_LENGTH = 40;

export const AUTHOR_AVATARS = [
  { id: "everyday", label: "日常", body: "#818CF8", background: "#EEF2FF" },
  { id: "chill", label: "摸鱼", body: "#768B65", background: "#EDF0E3" },
  { id: "sleepy", label: "困困", body: "#9281A5", background: "#F0EAF4" },
  { id: "inspired", label: "灵感", body: "#CA9745", background: "#FCF2D8" },
  { id: "focused", label: "专注", body: "#638B9C", background: "#E8F0F3" },
  { id: "happy", label: "开心", body: "#C9787C", background: "#F9E9E7" },
] as const;

export function resolveAuthorName(name?: string | null): string {
  return name?.trim() || DEFAULT_AUTHOR_NAME;
}

export function resolveAuthorAvatar(id?: string | null) {
  return AUTHOR_AVATARS.find(avatar => avatar.id === id) ?? AUTHOR_AVATARS[0];
}
