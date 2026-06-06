import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/types";

export function MatchWhySection({ lead, isVenue = false }: { lead: Lead; isVenue?: boolean }) {
  const [open, setOpen] = useState(false);
  const factors = lead.matchFactors;

  return (
    <div className="rounded-2xl border border-[#e3dcc8] bg-[#faf6ee]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-[#29361f]"
      >
        De ce această potrivire?
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-[#e3dcc8] px-3 py-2 text-xs text-[#5a654f]">
          {lead.matchedNeeds?.length ? (
            <p>
              <span className="font-bold text-[#33412c]">Produse potrivite:</span>{" "}
              {lead.matchedNeeds.join(", ")}
            </p>
          ) : null}
          {factors ? (
            <>
              <p>
                <span className="font-bold text-[#33412c]">Scor produse:</span> +{factors.productScore}
              </p>
              <p>
                <span className="font-bold text-[#33412c]">Distanță:</span> {Math.round(factors.distanceKm)} km
                {factors.producerRangeKm ? ` (livrează până la ${Math.round(factors.producerRangeKm)} km)` : ""}
              </p>
              <p>
                <span className="font-bold text-[#33412c]">În raza ta:</span>{" "}
                {factors.inRange ? "Da" : "Nu"}
              </p>
              {factors.proximityBonus > 0 ? (
                <p>
                  <span className="font-bold text-[#33412c]">Bonus proximitate:</span> +{factors.proximityBonus}
                </p>
              ) : null}
            </>
          ) : (
            <p>{isVenue ? lead.reason : lead.reason}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
