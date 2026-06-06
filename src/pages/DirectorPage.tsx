import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LayoutGrid, List, Loader2, MapPin, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Lead, LeadStats, LeadStatus, PlanContext, ProducerProduct } from "@/lib/types";
import { VenueStatsHeader } from "@/components/VenueStatsHeader";
import { LeadMapPanel } from "@/pages/LeadMapPanel";

type DistanceFilter = "all" | "10" | "25";
type TypeFilter = "all" | "restaurant" | "hotel" | "cafe" | "shop" | "deli";
type MobilePanel = "list" | "map";
type SortKey = "match" | "distance" | "name";
type StatusFilter = "all" | LeadStatus;
type RangeFilter = "all" | "inRange";

function StatsHeader({
  plan,
  stats,
  isVenue,
  onUpgrade,
}: {
  plan: PlanContext | null;
  stats: LeadStats | null;
  isVenue: boolean;
  onUpgrade: () => void;
}) {
  if (isVenue || !plan) return null;

  if (plan.tier !== "pro" || !stats) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-[#d7ccb3] bg-[#fffaf0] px-3 py-2 lg:py-2.5">
        <p className="text-xs text-[#5a654f] lg:text-sm">
          Vezi pipeline și calitate match cu Pro.
        </p>
        <Button type="button" size="sm" variant="honey" onClick={onUpgrade} className="shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
          Pro
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-[#c8d9aa] bg-[#f0f5e8] px-3 py-2 text-xs lg:py-2.5 lg:text-sm sm:grid-cols-3">
      <StatPill
        label="Pipeline"
        value={`${stats.pipeline.Contactat ?? 0} contactat · ${stats.pipeline["A răspuns"] ?? 0} răspuns`}
      />
      <StatPill
        label="Săptămâna asta"
        value={`${stats.weekly.activeLeads}/${stats.weekly.activeLimit} active`}
      />
      <StatPill
        label="Calitate"
        value={`${stats.matchQuality.averageMatch}% · ${stats.matchQuality.averageDistanceKm} km`}
      />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-[#5a7150]">{label}</p>
      <p className="font-semibold text-[#263421]">{value}</p>
    </div>
  );
}

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
): Lead[] {
  return leads.filter((lead) => {
    if (type !== "all" && lead.icon !== type) return false;
    if (statusFilter !== "all" && statuses[lead.id] !== statusFilter) return false;
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

function sortLeads(leads: Lead[], sortKey: SortKey): Lead[] {
  const copy = [...leads];
  if (sortKey === "match") return copy.sort((a, b) => b.match - a.match);
  if (sortKey === "distance") {
    return copy.sort(
      (a, b) =>
        (Number.parseFloat(a.distance.replace(" km", "")) || 0) -
        (Number.parseFloat(b.distance.replace(" km", "")) || 0),
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
  activeLeadCount,
  searchingMore,
  plan,
  stats,
  products,
  productChips,
  isVenue,
  venueProducerScope = "matched",
  onVenueProducerScopeChange,
  onSearchMore,
  onUpgrade,
  onDetails,
  onMessage,
  onStatus,
  onWhatsAppClick,
  onFailedClick,
}: {
  leads: Lead[];
  statuses: Record<string, LeadStatus>;
  failedFeedbacks: Record<string, string>;
  activeLeadCount: number;
  searchingMore?: boolean;
  plan: PlanContext | null;
  stats: LeadStats | null;
  products: ProducerProduct[];
  productChips?: string[];
  isVenue: boolean;
  venueProducerScope?: "matched" | "all";
  onVenueProducerScopeChange?: (scope: "matched" | "all") => void;
  onSearchMore?: () => void;
  onUpgrade: () => void;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onFailedClick: (lead: Lead) => void;
}) {
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("match");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
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
      filterLeads(leads, distanceFilter, typeFilter, productFilter, statusFilter, statuses, rangeFilter),
      sortKey,
    ),
    [leads, distanceFilter, typeFilter, productFilter, statusFilter, statuses, rangeFilter, sortKey],
  );

  const activeLimit = plan?.limits.activeLeads ?? activeLeadCount;
  const activeFilterCount =
    (distanceFilter !== "all" ? 1 : 0) +
    (!isVenue && typeFilter !== "all" ? 1 : 0) +
    (productFilter ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (isVenue && rangeFilter !== "all" ? 1 : 0) +
    (sortKey !== "match" ? 1 : 0);

  const resetFilters = () => {
    setDistanceFilter("all");
    setTypeFilter("all");
    setProductFilter(null);
    setSortKey("match");
    setStatusFilter("all");
    setRangeFilter("all");
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#fbf7ed]">
      <div className="sticky top-0 z-10 shrink-0 space-y-1.5 border-b border-[#d7ccb3] bg-[#fbf7ed] px-3 py-2 lg:px-4 lg:py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="hidden items-center gap-2 text-base font-extrabold text-[#263421] lg:flex">
              <LayoutGrid className="h-4 w-4" />
              {isVenue ? "Director producători" : "Director lead-uri"}
            </p>
            <p className="text-xs text-muted-foreground lg:text-sm">
              <span className="font-semibold text-[#263421]">
                {filteredLeads.length} rezultate
              </span>
              <span className="hidden lg:inline">
                {" "}
                · {isVenue ? "Hartă, listă și filtre" : "Recomandări, hartă și statistici"}
              </span>
            </p>
          </div>
          <Badge variant="warm" className="shrink-0">
            {activeLeadCount}
            {!isVenue && plan ? `/${activeLimit}` : ""} {isVenue ? "activi" : "active"}
          </Badge>
        </div>

        {isVenue ? (
          <VenueStatsHeader leads={leads} statuses={statuses} />
        ) : (
          <div className="block">
            <StatsHeader plan={plan} stats={stats} isVenue={isVenue} onUpgrade={onUpgrade} />
          </div>
        )}

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
                {isVenue ? "Vezi toți producătorii" : "Caută alte lead-uri"}
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
              ] as Array<[SortKey, string]>).map(([value, label]) => (
                <FilterChip key={value} active={sortKey === value} label={label} onClick={() => setSortKey(value)} />
              ))}
            </FilterSection>

            <FilterSection label="Status">
              {(["all", "Bun", "Contactat", "A răspuns", "Nu e potrivit"] as StatusFilter[]).map((value) => (
                <FilterChip
                  key={value}
                  active={statusFilter === value}
                  label={value === "all" ? "Toate statusurile" : value}
                  onClick={() => setStatusFilter(value)}
                />
              ))}
            </FilterSection>

            {isVenue ? (
              <FilterSection label="Livrare">
                <FilterChip active={rangeFilter === "all"} label="Toată raza" onClick={() => setRangeFilter("all")} />
                <FilterChip active={rangeFilter === "inRange"} label="Livrare la mine" onClick={() => setRangeFilter("inRange")} />
              </FilterSection>
            ) : null}

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
