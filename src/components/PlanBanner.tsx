import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlanContext } from "@/lib/types";

export function PlanBanner({
  plan,
  isVenue,
  onUpgrade,
}: {
  plan: PlanContext | null;
  isVenue: boolean;
  onUpgrade: () => void;
}) {
  if (!plan || isVenue || plan.tier === "pro") {
    return null;
  }

  const remainingWeekly = Math.max(
    0,
    plan.limits.weeklyDiscoveries - plan.usage.weeklyDiscoveries,
  );
  const remainingActive = Math.max(0, plan.limits.activeLeads - plan.usage.activeLeads);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e3d4a8] bg-[#fff8e8] px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-[#5a4a20]">
        <Badge variant="warm">Free</Badge>
        <span>
          {remainingWeekly} recomandări rămase săptămâna asta · {remainingActive} sloturi active
        </span>
      </div>
      <Button type="button" size="sm" variant="honey" onClick={onUpgrade} className="shrink-0">
        <Sparkles className="h-3.5 w-3.5" />
        Pro (demo)
      </Button>
    </div>
  );
}
