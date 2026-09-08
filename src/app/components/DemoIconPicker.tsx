import { useId } from "react";
import { DEMO_ICONS, demoIconOption } from "../content/demos";
import { DemoIcon } from "./DemoIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function DemoIconPicker({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId();
  const option = demoIconOption(value);
  return (
    <div>
      <label id={`${id}-label`} htmlFor={id}>封面图标 *</label>
      <Select name="icon" value={option?.value ?? value} onValueChange={onChange} disabled={disabled} required>
        <SelectTrigger id={id} aria-labelledby={`${id}-label`} className="wonder-icon-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[310] max-h-72">
          {!option && <SelectItem value={value}><DemoIcon value={value} size={18} /><span>当前符号</span></SelectItem>}
          {DEMO_ICONS.map(icon => (
            <SelectItem key={icon.value} value={icon.value} textValue={icon.label}>
              <DemoIcon value={icon.value} size={18} />
              <span>{icon.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
