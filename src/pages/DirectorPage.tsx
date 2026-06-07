import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LayoutGrid, List, Loader2, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus, ProducerProduct } from "@/lib/types";
import type { VenueMatchDiagnostics } from "@/lib/venueChatUtils";
import { DirectorPipelineStats } from "@/components/DirectorPipelineStats";
import { VenueMatchDiagnosticsPanel } from "@/components/VenueMatchDiagnosticsPanel";
import { LeadMapPanel } from "@/pages/LeadMapPanel";

type DistanceFilter = "all" | "10" | "25";
type TypeFilter = "all" | "restaurant" | "hotel" | "cafe" | "shop" | "deli";
type MobilePanel = "list" | "map";
type SortKey = "match" | "distance" | "name" | "verified";
type StatusFilter = "all" | LeadStatus;
type RangeFilter = "all" | "inRange";
type VerifiedFilter = "all" | "verifiedOnly";
type RegisteredFilter = "all" | "registeredOnly";

function MobileViewToggle({
  panel,
  onChange,
  leadCount,
}: {
  panel: MobilePanel;
  onChange: (panel: MobilePanel) => void;
  leadCount: number;
}) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-[#d7ccb3] bg-[#f8f4ea] px-3 py-2 lg:hidden">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition",
          panel === "list"
            ? "bg-[#4d6638] text-white shadow-sm"
            : "border border-[#ded5bf] bg-white text-[#526047]",
        )}
      >
        <List className="h-4 w-4" />
        Listă ({leadCount})
      </button>
      <button
        type="button"
        onClick={() => onChange("map")}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition",
          panel === "map"
            ? "bg-[#4d6638] text-white shadow-sm"
            : "border border-[#ded5bf] bg-white text-[#526047]",
        )}
      >
        <MapPin className="h-4 w-4" />
        Hartă
      </button>
    </div>
  );
}

function filterLeads(
  leads: Lead[],
  distance: DistanceFilter,
  type: TypeFilter,
  product: string | null,
  statusFilter: StatusFilter,
  statuses: Record<string, LeadStatus>,
  rangeFilter: RangeFilter,
  verifiedFilter: VerifiedFilter,
  registeredFilter: RegisteredFilter,
): Lead[] {
  return leads.filter((lead) => {
    if (type !== "all" && lead.icon !== type) return false;
    if (statusFilter !== "all" && statuses[lead.id] !== statusFilter) return false;
    if (verifiedFilter === "verifiedOnly" && !lead.verified) return false;
    if (registeredFilter === "registeredOnly" && !lead.platformRegistered) return false;
    if (rangeFilter === "inRange" && lead.matchFactors && !lead.matchFactors.inRange) return false;
    if (product) {
      const hay = `${lead.sell} ${lead.reason} ${(lead.matchedNeeds ?? []).join(" ")} ${(lead.needs ?? []).join(" ")}`.toLowerCase();
      if (!hay.includes(product.toLowerCase())) return false;
    }
    if (distance !== "all") {
      const km = Number.parseFloat(lead.distance.replace(" km", "")) || 0;
      if (km > Number.parseInt(distance, 10)) return false;
    }
    return true;
  });
}

function leadDistanceKm(lead: Lead): number {
  return Number.parseFloat(lead.distance.replace(" km", "")) || 0;
}

function sortLeads(leads: Lead[], sortKey: SortKey): Lead[] {
  const copy = [...leads];
  if (sortKey === "match") return copy.sort((a, b) => b.match - a.match);
  if (sortKey === "distance") {
    return copy.sort((a, b) => leadDistanceKm(a) - leadDistanceKm(b));
  }
  if (sortKey === "verified") {
    return copy.sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) ||
        b.match - a.match ||
        leadDistanceKm(a) - leadDistanceKm(b),
    );
  }
  return copy.sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

function VenueProducerScopeToggle({
  scope,
  onChange,
}: {
  scope: "matched" | "all";
  onChange: (scope: "matched" | "all") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange("matched")}
        className={cn(
          "rounded-xl px-3 py-2 text-xs font-bold transition sm:text-sm",
          scope === "matched"
            ? "bg-[#4d6638] text-white"
            : "border border-[#ded5bf] bg-white text-[#526047]",
        )}
      >
        Potriviți
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "rounded-xl px-3 py-2 text-xs font-bold transition sm:text-sm",
          scope === "all"
            ? "bg-[#4d6638] text-white"
            : "border border-[#ded5bf] bg-white text-[#526047]",
        )}
      >
        Toți producătorii
      </button>
    </div>
  );
}

export function DirectorPage({
  leads,
  statuses,
  failedFeedbacks,
  newLeadIds,
  searchingMore,
  products,
  productChips,
  isVenue,
  venueProducerScope = "matched",
  onVenueProducerScopeChange,
  onSearchMore,
  searchMoreLabel,
  onDetails,
  onMessage,
  onStatus,
  onWhatsAppClick,
  onFailedClick,
  matchDiagnostics,
  matchProductLabel,
}: {
  leads: Lead[];
  statuses: Record<string, LeadStatus>;
  failedFeedbacks: Record<string, string>;
  newLeadIds?: Set<string>;
  searchingMore?: boolean;
  products: ProducerProduct[];
  productChips?: string[];
  isVenue: boolean;
  venueProducerScope?: "matched" | "all";
  onVenueProducerScopeChange?: (scope: "matched" | "all") => void;
  onSearchMore?: () => void;
  searchMoreLabel?: string;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onFailedClick: (lead: Lead) => void;
  matchDiagnostics?: VenueMatchDiagnostics;
  matchProductLabel?: string;
}) {
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("match");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>("all");
  const [registeredFilter, setRegisteredFilter] = useState<RegisteredFilter>("all");
  const [isWideLayout, setIsWideLayout] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsWideLayout(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const filterProductChips = useMemo(
    () =>
      productChips?.length
        ? productChips
        : (products ?? []).map((p) => p.name.trim()).filter(Boolean).slice(0, 6),
    [productChips, products],
  );

  const filteredLeads = useMemo(
    () => sortLeads(
      filterLeads(
        leads,
        distanceFilter,
        typeFilter,
        productFilter,
        statusFilter,
        statuses,
        rangeFilter,
        isVenue ? verifiedFilter : "all",
        isVenue ? "all" : registeredFilter,
      ),
      sortKey,
    ),
    [leads, distanceFilter, typeFilter, productFilter, statusFilter, statuses, rangeFilter, verifiedFilter, registeredFilter, isVenue, sortKey],
  );

  const activeFilterCount =
    (distanceFilter !== "all" ? 1 : 0) +
    (!isVenue && typeFilter !== "all" ? 1 : 0) +
    (productFilter ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (isVenue && rangeFilter !== "all" ? 1 : 0) +
    (isVenue && verifiedFilter !== "all" ? 1 : 0) +
    (!isVenue && registeredFilter !== "all" ? 1 : 0) +
    (sortKey !== "match" ? 1 : 0);

  const resetFilters = () => {
    setDistanceFilter("all");
    setTypeFilter("all");
    setProductFilter(null);
    setSortKey("match");
    setStatusFilter("all");
    setRangeFilter("all");
    setVerifiedFilter("all");
    setRegisteredFilter("all");
  };

  const showMatchDiagnostics = isVenue && leads.length === 0 && matchDiagnostics;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#fbf7ed]">
      <div className="sticky top-0 z-10 shrink-0 space-y-1.5 border-b border-[#d7ccb3] bg-[#fbf7ed] px-3 py-2 lg:px-4 lg:py-2.5">
        <div className="min-w-0">
          <p className="hidden items-center gap-2 text-base font-extrabold text-[#263421] lg:flex">
            <LayoutGrid className="h-4 w-4" />
            {isVenue ? "Director producători" : "Director lead-uri"}
          </p>
          <p className="text-xs text-muted-foreground lg:text-sm">
            <span className="font-semibold text-[#263421]">{filteredLeads.length} rezultate</span>
            <span className="hidden lg:inline"> · Hartă, listă și filtre</span>
          </p>
        </div>

        <DirectorPipelineStats statuses={statuses} />

        <div className="flex flex-wrap items-center gap-2">
          {isVenue && onVenueProducerScopeChange ? (
            <VenueProducerScopeToggle
              scope={venueProducerScope}
              onChange={onVenueProducerScopeChange}
            />
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-8 border-[#ded5bf] bg-white text-xs",
              isVenue && onVenueProducerScopeChange ? "" : "flex-1 sm:flex-none",
            )}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Filtre{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          {onSearchMore ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={searchingMore}
              onClick={onSearchMore}
              className="h-8 shrink-0 border-[#c8d9aa] bg-[#f0f5e8] px-2.5 text-xs text-[#3f532c] hover:bg-[#e3edd4] lg:px-3"
            >
              {searchingMore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5 lg:mr-1.5" />
              )}
              <span className="hidden lg:inline">
                {searchMoreLabel ?? (isVenue ? "Vezi toți producătorii" : "Caută alte lead-uri")}
              </span>
            </Button>
          ) : null}
        </div>

        <div className={cn(filtersOpen ? "block" : "hidden")}>
          <div className="space-y-2.5 rounded-2xl border border-[#ded5bf] bg-white p-3">
            <FilterSection label="Distanță">
              {(["all", "10", "25"] as DistanceFilter[]).map((value) => (
                <FilterChip
                  key={value}
                  active={distanceFilter === value}
                  label={value === "all" ? "Toată raza" : `<${value} km`}
                  onClick={() => setDistanceFilter(value)}
                />
              ))}
            </FilterSection>

            {!isVenue ? (
              <FilterSection label="Tip">
                {(["all", "restaurant", "hotel", "cafe", "shop"] as TypeFilter[]).map((value) => (
                  <FilterChip
                    key={value}
                    active={typeFilter === value}
                    label={value === "all" ? "Toate tipurile" : value}
                    onClick={() => setTypeFilter(value)}
                  />
                ))}
              </FilterSection>
            ) : null}

            {filterProductChips.length ? (
              <FilterSection label="Produs">
                <FilterChip
                  active={productFilter === null}
                  label="Toate produsele"
                  onClick={() => setProductFilter(null)}
                />
                {filterProductChips.map((name) => (
                  <FilterChip
                    key={name}
                    active={productFilter === name}
                    label={name}
                    onClick={() => setProductFilter(name)}
                  />
                ))}
              </FilterSection>
            ) : null}

            <FilterSection label="Sortare">
              {([
                ["match", "Potrivire"],
                ["distance", "Distanță"],
                ["name", "Nume"],
                ...(isVenue ? [["verified", "Verificați"] as [SortKey, string]] : []),
              ] as Array<[SortKey, string]>).map(([value, label]) => (
                <FilterChip key={value} active={sortKey === value} label={label} onClick={() => setSortKey(value)} />
              ))}
            </FilterSection>

            <FilterSection label="Status">
              {(["all", "Contactat", "A răspuns", "A cumpărat", "Nu e potrivit"] as StatusFilter[]).map((value) => (
                <FilterChip
                  key={value}
                  active={statusFilter === value}
                  label={value === "all" ? "Toate statusurile" : value}
                  onClick={() => setStatusFilter(value)}
                />
              ))}
            </FilterSection>

            {isVenue ? (
              <>
                <FilterSection label="Verificat">
                  <FilterChip active={verifiedFilter === "all"} label="Toți" onClick={() => setVerifiedFilter("all")} />
                  <FilterChip
                    active={verifiedFilter === "verifiedOnly"}
                    label="Doar verificați"
                    onClick={() => setVerifiedFilter("verifiedOnly")}
                  />
                </FilterSection>
                <FilterSection label="Livrare">
                  <FilterChip active={rangeFilter === "all"} label="Toată raza" onClick={() => setRangeFilter("all")} />
                  <FilterChip active={rangeFilter === "inRange"} label="Livrare la mine" onClick={() => setRangeFilter("inRange")} />
                </FilterSection>
              </>
            ) : (
              <FilterSection label="Înregistrat">
                <FilterChip active={registeredFilter === "all"} label="Toate sursele" onClick={() => setRegisteredFilter("all")} />
                <FilterChip
                  active={registeredFilter === "registeredOnly"}
                  label="Doar înregistrate"
                  onClick={() => setRegisteredFilter("registeredOnly")}
                />
              </FilterSection>
            )}

            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-[#4d6638] underline-offset-2 hover:underline"
              >
                Resetează filtre
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showMatchDiagnostics ? (
        <div className="shrink-0 px-3 py-2 lg:px-4">
          <VenueMatchDiagnosticsPanel
            diagnostics={matchDiagnostics}
            productLabel={matchProductLabel}
            scope={venueProducerScope}
            onShowAll={onSearchMore}
          />
        </div>
      ) : null}

      <MobileViewToggle
        panel={mobilePanel}
        onChange={setMobilePanel}
        leadCount={filteredLeads.length}
      />

      <LeadMapPanel
        key={mobilePanel}
        leads={filteredLeads}
        statuses={statuses}
        failedFeedbacks={failedFeedbacks}
        newLeadIds={newLeadIds}
        activeLeadCount={filteredLeads.length}
        onDetails={onDetails}
        onMessage={onMessage}
        onStatus={onStatus}
        onWhatsAppClick={onWhatsAppClick}
        onFailedClick={onFailedClick}
        isVenue={isVenue}
        embedded
        layout="split"
        mobilePanel={mobilePanel}
        mapActive={isWideLayout || mobilePanel === "map"}
        listPrimary={isVenue}
      />
    </aside>
  );
}

function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#8a9478]">{label}</p>
      <div className="flex flex-wrap gap-1 overflow-x-auto pb-0.5 no-scrollbar sm:overflow-visible">
        {children}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold transition",
        active
          ? "border-[#4d6638] bg-[#4d6638] text-white"
          : "border-[#ded5bf] bg-white text-[#526047] hover:bg-[#f1eadb]",
      )}
    >
      {label}
    </button>
  );
}

export default DirectorPage;
