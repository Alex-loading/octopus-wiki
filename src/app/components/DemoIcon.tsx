import {
  Activity, Blocks, Bot, ChartColumn, Command, FileUser, Flower2, Gamepad2,
  Globe, MousePointer2, Music, Palette, Sparkles, SquareCode, WandSparkles,
  Workflow, type LucideIcon,
} from "lucide-react";
import { DEMO_ICONS, demoIconOption } from "../content/demos";

// Explicit imports keep the picker from bundling the entire Lucide catalog.
const icons: Record<(typeof DEMO_ICONS)[number]["value"], LucideIcon> = {
  sparkles: Sparkles,
  "wand-sparkles": WandSparkles,
  "flower-2": Flower2,
  "mouse-pointer-2": MousePointer2,
  blocks: Blocks,
  command: Command,
  "square-code": SquareCode,
  workflow: Workflow,
  activity: Activity,
  music: Music,
  "chart-column": ChartColumn,
  "file-user": FileUser,
  palette: Palette,
  bot: Bot,
  globe: Globe,
  "gamepad-2": Gamepad2,
};

export function DemoIcon({ value, size = 24, className }: { value: string; size?: number; className?: string }) {
  const option = demoIconOption(value);
  if (!option) {
    // Keep custom symbols from older projects readable until an icon is chosen.
    return <span aria-hidden="true" className={className} style={{ fontSize: size, lineHeight: 1 }}>{value}</span>;
  }
  const Icon = icons[option.value];
  return <Icon aria-hidden="true" size={size} strokeWidth={1.5} className={className} />;
}
