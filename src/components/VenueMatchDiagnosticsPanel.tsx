import { Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildVenueMatchDiagnosticsHint,
  formatVenueMatchDiagnosticsSummary,
  type VenueMatchDiagnostics,
} from "@/lib/venueChatUtils";

export function VenueMatchDiagnosticsPanel({
  diagnostics,
  productLabel,
  scope = "matched",
  onShowAll,
  compact = false,
}: {
  diagnostics: VenueMatchDiagnostics;
  productLabel?: string;
  scope?: "matched" | "all";
  onShowAll?: () => void;
  compact?: boolean;
}) {
  const summary = formatVenueMatchDiagnosticsSummary(diagnostics);
  const hint = buildVenueMatchDiagnosticsHint(diagnostics, productLabel, scope);
  const showAllCta =
    onShowAll &&
    scope === "matched" &&
    (diagnostics.outOfRangeOnly > 0 || diagnostics.productRelevant > diagnostics.inRange);

  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-dashed border-[#d7ccb3] bg-[#fffaf0] px-3 py-2.5"
          : "rounded-2xl border border-dashed border-[#d7ccb3] bg-[#fffaf0] px-4 py-3"
      }
    >
      <div className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0e6c8] text-[#6b5a2e]">
          <Info className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#8a9478]">De ce nu apar rezultate</p>
          <p className="text-sm font-semibold text-[#263421]">{summary}</p>
          <p className="text-sm leading-relaxed text-[#5a654f]">{hint}</p>
          {showAllCta ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onShowAll}
              className="mt-1 h-8 border-[#c8d9aa] bg-[#f0f5e8] text-xs text-[#3f532c] hover:bg-[#e3edd4]"
            >
              <Search className="h-3.5 w-3.5" />
              Vezi toți producătorii
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
