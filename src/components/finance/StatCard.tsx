import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/finance";

type Props = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "primary" | "danger" | "neutral" | "warning";
  hint?: string;
};

const tones: Record<string, string> = {
  primary: "text-primary",
  danger: "text-destructive",
  neutral: "text-foreground",
  warning: "text-warning",
};

export function StatCard({ label, value, icon: Icon, tone = "neutral", hint }: Props) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("rounded-lg bg-secondary/60 p-2", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("numeric mt-3 text-2xl font-semibold tracking-tight", tones[tone])}>
        {brl(value)}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
