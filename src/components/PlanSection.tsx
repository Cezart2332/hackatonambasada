import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlanContext } from "@/lib/types";

function formatResetDate(iso: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function PlanSection({
  plan,
  upgrading,
  onUpgrade,
  onDowngrade,
}: {
  plan: PlanContext | null;
  upgrading?: boolean;
  onUpgrade: () => void;
  onDowngrade?: () => void;
}) {
  if (!plan) return null;

  const isPro = plan.tier === "pro";

  return (
    <div className="rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#263421]">Plan & utilizare</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isPro
              ? "Ai acces la toate funcțiile Pro (demo)."
              : "Plan gratuit — 3 recomandări pe săptămână."}
          </p>
        </div>
        <Badge variant={isPro ? "olive" : "warm"}>{isPro ? "Pro" : "Free"}</Badge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <UsageTile
          label="Recomandări săptămână"
          value={
            isPro
              ? `${plan.usage.weeklyDiscoveries} folosite`
              : `${plan.usage.weeklyDiscoveries}/${plan.limits.weeklyDiscoveries}`
          }
        />
        <UsageTile
          label="Lead-uri active"
          value={`${plan.usage.activeLeads}/${plan.limits.activeLeads}`}
        />
        <UsageTile
          label="Simulări săptămână"
          value={
            isPro
              ? `${plan.usage.weeklySimulations}`
              : `${plan.usage.weeklySimulations}/${plan.limits.weeklySimulations}`
          }
        />
      </div>

      {!isPro ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Reset recomandări: {formatResetDate(plan.resetsAt)}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {isPro ? (
          <>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[#405235]">
              <Check className="h-4 w-4" />
              Pro activ
            </span>
            {onDowngrade ? (
              <Button type="button" size="sm" variant="outline" onClick={onDowngrade}>
                Revino la Free (demo)
              </Button>
            ) : null}
          </>
        ) : (
          <Button type="button" size="sm" variant="honey" disabled={upgrading} onClick={onUpgrade}>
            <Sparkles className="h-4 w-4" />
            {upgrading ? "Se activează..." : "Activează Pro (demo)"}
          </Button>
        )}
      </div>
    </div>
  );
}

function UsageTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#eadfca] bg-white/70 px-3 py-2">
      <p className="text-[11px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-[#263421]">{value}</p>
    </div>
  );
}
