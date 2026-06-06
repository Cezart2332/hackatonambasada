import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { venueSessionStep, type VenueChatSession } from "@/lib/venueChatUtils";

const STEPS = [
  { label: "Produse", description: "Ce cauți" },
  { label: "Cantitate", description: "Frecvență" },
  { label: "Livrare", description: "Zile preferate" },
] as const;

export function VenueChatProgress({ session }: { session: VenueChatSession }) {
  const completed = venueSessionStep(session);

  if (completed >= 3) return null;

  return (
    <div className="mx-auto mb-3 max-w-3xl rounded-2xl border border-[#ded5bf] bg-[#fffaf0] px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Înainte de recomandări · pas {Math.min(completed + 1, 3)}/3
      </p>
      <div className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const done = completed > index;
          const active = completed === index;
          return (
            <div key={step.label} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  done
                    ? "bg-[#526b36] text-white"
                    : active
                      ? "bg-[#d4e3b8] text-[#3f532c] ring-2 ring-[#8faa5c]"
                      : "bg-[#ece5d4] text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-xs font-semibold",
                    active || done ? "text-[#263421]" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{step.description}</p>
              </div>
              {index < STEPS.length - 1 ? (
                <div className={cn("h-px flex-1", done ? "bg-[#8faa5c]" : "bg-[#ded5bf]")} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
