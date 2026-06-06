import React, { useEffect, type ComponentType } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Navigation,
  MapPin,
  Utensils,
  Building2,
  Coffee,
  Beef,
  Wine,
  MessageCircle,
  AlertTriangle,
  Search,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MatchWhySection } from "@/components/MatchWhySection";
import type { Lead, LeadStatus } from "@/lib/types";

const feedbackOptions: LeadStatus[] = ["Bun", "Nu e potrivit", "Contactat", "A răspuns", "A cumpărat"];

const LeafletMapContainer = MapContainer as unknown as ComponentType<Record<string, unknown>>;
const LeafletCircleMarker = CircleMarker as unknown as ComponentType<Record<string, unknown>>;

function MapResizeHandler({ active }: { active?: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (active === false) return;

    const fix = () => {
      map.invalidateSize({ animate: false });
    };

    fix();
    const timers = [0, 100, 350].map((ms) => window.setTimeout(fix, ms));
    const parent = map.getContainer().parentElement;
    const observer = parent ? new ResizeObserver(fix) : null;
    observer?.observe(parent);
    window.addEventListener("resize", fix);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      observer?.disconnect();
      window.removeEventListener("resize", fix);
    };
  }, [map, active]);

  return null;
}

function FitMapBounds({ leads }: { leads: Lead[] }) {
  const map = useMap();

  useEffect(() => {
    if (!leads.length) return;
    const lats = leads.map((lead) => lead.coordinates[0]);
    const lngs = leads.map((lead) => lead.coordinates[1]);
    const padding = 0.12;
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);
    map.fitBounds(
      [
        [Math.min(...lats) - latSpan * padding, Math.min(...lngs) - lngSpan * padding],
        [Math.max(...lats) + latSpan * padding, Math.max(...lngs) + lngSpan * padding],
      ],
      { animate: false },
    );
  }, [map, leads]);

  return null;
}

function LeadsMap({
  leads,
  statuses,
  onMessage,
  active = true,
}: {
  leads: Lead[];
  statuses: Record<string, LeadStatus>;
  onMessage: (lead: Lead) => void;
  active?: boolean;
}) {
  return (
    <LeafletMapContainer
      center={[44.13, 28.62]}
      zoom={9}
      scrollWheelZoom
      className="h-full w-full min-h-[240px]"
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapResizeHandler active={active} />
      <FitMapBounds leads={leads} />
      {leads.map((lead) => (
        <LeafletCircleMarker
          key={lead.id}
          center={lead.coordinates}
          radius={statuses[lead.id] === "Nu e potrivit" ? 7 : 10}
          pathOptions={{
            color: statuses[lead.id] === "Nu e potrivit" ? "#9a7768" : "#4d6638",
            fillColor: statuses[lead.id] === "Contactat" ? "#e3a72f" : "#6d823c",
            fillOpacity: 0.88,
            weight: 2,
          }}
        >
          <Popup>
            <div className="min-w-[210px] space-y-2">
              <p className="font-bold text-[#263421]">{lead.name}</p>
              <p className="text-sm text-[#5a654f]">{lead.type}</p>
              <p className="text-sm font-semibold text-[#526b36]">
                {lead.match}% potrivire · {lead.distance}
              </p>
              <button
                type="button"
                className="rounded-full bg-[#4d6638] px-3 py-1.5 text-xs font-bold text-white"
                onClick={() => onMessage(lead)}
              >
                Scrie mesaj
              </button>
            </div>
          </Popup>
        </LeafletCircleMarker>
      ))}
    </LeafletMapContainer>
  );
}

function leadIcon(icon: Lead["icon"]) {
  const icons = {
    restaurant: Utensils,
    hotel: Building2,
    cafe: Coffee,
    shop: Beef,
    deli: Wine,
  };

  return icons[icon];
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const classNameByStatus: Record<LeadStatus, string> = {
    Bun: "border-[#c8d9aa] bg-[#e8f0d7] text-[#3f532c]",
    "Nu e potrivit": "border-[#ead2cc] bg-[#fae8e4] text-[#884636]",
    Contactat: "border-[#d6c28b] bg-[#fff0bc] text-[#6f5114]",
    "A răspuns": "border-[#c7dbe3] bg-[#e7f1f4] text-[#315765]",
    "A cumpărat": "border-[#bcd5b6] bg-[#dbefd7] text-[#2f643b]",
  };

  return <Badge className={classNameByStatus[status]}>{status}</Badge>;
}

export function MapLeadRow({
  lead,
  status,
  failedFeedback,
  onDetails,
  onMessage,
  onStatus,
  onWhatsAppClick,
  onFailedClick,
  isVenue = false,
}: {
  lead: Lead;
  status?: LeadStatus;
  failedFeedback?: string;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onFailedClick: (lead: Lead) => void;
  isVenue?: boolean;
}) {
  const Icon = leadIcon(lead.icon);

  return (
    <div className={cn(
      "w-full rounded-2xl border p-3 transition-colors",
      failedFeedback ? "border-[#ead2cc] bg-[#fffcfb]" : "border-[#ded5bf] bg-[#fffdf7]"
    )}>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e9f0dc] text-[#4d6638]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <p className="truncate text-sm font-extrabold text-[#263421]">{lead.name}</p>
                {lead.verified ? <Badge variant="olive" className="shrink-0 text-[10px]">Verificat</Badge> : null}
                {lead.match >= 85 ? <Badge variant="warm" className="shrink-0 text-[10px]">Top</Badge> : null}
                {lead.matchFactors ? (
                  <Badge variant={lead.matchFactors.inRange ? "olive" : "outline"} className="shrink-0 text-[10px]">
                    {lead.matchFactors.inRange ? "În raza ta" : "În afara razei"}
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">{lead.location}</p>
            </div>
            <Badge variant="blue" className="shrink-0">
              {lead.match}%
            </Badge>
          </div>
          
          {lead.phone ? (
            <p className="mt-1 text-[11px] text-[#6a7360]">
              {lead.contactPerson ? `👤 ${lead.contactPerson} · ` : ""}📞 {lead.phone}
            </p>
          ) : null}

          <p className="mt-2 line-clamp-2 text-xs text-[#5a654f]">
{isVenue ? "Recomand pentru că" : "Îl recomand pentru că"} {lead.reason}
          </p>

          {failedFeedback ? (
            <div className="mt-2 text-xs font-semibold text-[#884636] bg-[#fae8e4] border border-[#ead2cc] rounded-xl p-2 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#884636] mt-0.5" />
              <span>Contact eșuat: {failedFeedback}</span>
            </div>
          ) : null}

          <p className="mt-2 line-clamp-2 text-xs text-[#5a654f]">
            <span className="font-bold">{isVenue ? "Oferă:" : "Ai putea să-i vinzi:"}</span> {lead.sell}
          </p>

          {isVenue ? <div className="mt-2"><MatchWhySection lead={lead} isVenue /></div> : null}

          {status ? (
            <div className="mt-2">
              <StatusBadge status={status} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onDetails(lead)}>
          Detalii
        </Button>
        <Button type="button" variant="honey" size="sm" className="min-h-11" onClick={() => onMessage(lead)}>
          Mesaj
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onWhatsAppClick(lead)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 text-rose-700 hover:bg-rose-50 border-rose-200 hover:border-rose-300"
          onClick={() => onFailedClick(lead)}
        >
          Ceva n-a mers
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {feedbackOptions.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={status === option ? "default" : "chip"}
            className="h-8"
            onClick={() => onStatus(lead, option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

function LeadsList({
  leads,
  statuses,
  failedFeedbacks,
  onDetails,
  onMessage,
  onStatus,
  onWhatsAppClick,
  onFailedClick,
  isVenue = false,
}: {
  leads: Lead[];
  statuses: Record<string, LeadStatus>;
  failedFeedbacks: Record<string, string>;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onFailedClick: (lead: Lead) => void;
  isVenue?: boolean;
}) {
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto flex w-full max-w-full flex-col gap-2 px-4 py-3">
        {leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Niciun lead nu trece filtrele selectate.
          </p>
        ) : null}
        {leads.map((lead) => (
          <MapLeadRow
            key={lead.id}
            lead={lead}
            status={statuses[lead.id]}
            failedFeedback={failedFeedbacks[lead.id]}
            onDetails={onDetails}
            onMessage={onMessage}
            onStatus={onStatus}
            onWhatsAppClick={onWhatsAppClick}
            onFailedClick={onFailedClick}
            isVenue={isVenue}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

export function LeadMapPanel({
  leads,
  statuses,
  failedFeedbacks = {},
  activeLeadCount,
  searchingMore = false,
  onSearchMore,
  onDetails,
  onMessage,
  onStatus,
  onWhatsAppClick,
  onFailedClick,
  isVenue = false,
  embedded = false,
  layout = "stack",
  mobilePanel = "list",
  mapActive = true,
}: {
  leads: Lead[];
  statuses: Record<string, LeadStatus>;
  failedFeedbacks?: Record<string, string>;
  activeLeadCount: number;
  searchingMore?: boolean;
  onSearchMore?: () => void;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onFailedClick: (lead: Lead) => void;
  isVenue?: boolean;
  embedded?: boolean;
  layout?: "stack" | "split";
  mobilePanel?: "list" | "map";
  mapActive?: boolean;
}) {
  const list = (
    <LeadsList
      leads={leads}
      statuses={statuses}
      failedFeedbacks={failedFeedbacks}
      onDetails={onDetails}
      onMessage={onMessage}
      onStatus={onStatus}
      onWhatsAppClick={onWhatsAppClick}
      onFailedClick={onFailedClick}
      isVenue={isVenue}
    />
  );

  const map = (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#e8e4da]">
      {mapActive ? (
        <LeadsMap leads={leads} statuses={statuses} onMessage={onMessage} active={mapActive} />
      ) : null}
    </div>
  );

  const mapAndList =
    layout === "split" ? (
      <div className="flex h-full min-h-0 w-full flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,42%)]">
        <div
          className={cn(
            "min-h-0 overflow-hidden border-[#d7ccb3] lg:border-r",
            mobilePanel === "list" ? "flex flex-1 flex-col" : "hidden lg:flex lg:flex-col",
          )}
        >
          {list}
        </div>
        <div
          className={cn(
            "min-h-0 overflow-hidden",
            mobilePanel === "map" ? "flex flex-1 flex-col" : "hidden lg:flex lg:flex-col",
          )}
        >
          {map}
        </div>
      </div>
    ) : (
      <>
        <div className="h-[280px] shrink-0 border-b border-[#d7ccb3]">
          {mapActive ? map : null}
        </div>
        {list}
      </>
    );

  if (embedded) {
    return (
      <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden bg-[#fbf7ed]">
        {mapAndList}
      </div>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-[#fbf7ed]">
      <div className="shrink-0 border-b border-[#d7ccb3] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-extrabold text-[#263421]">
              {isVenue ? "Hartă producători" : "Hartă lead-uri"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isVenue
                ? "Producători locali din Dobrogea care livrează în zona ta."
                : "POI-uri cu restaurante, hoteluri și băcănii din Dobrogea."}
            </p>
          </div>
          <Badge variant="warm">
            {activeLeadCount} {isVenue ? "activi" : "active"}
          </Badge>
        </div>
        {onSearchMore ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={searchingMore}
            onClick={onSearchMore}
            className="mt-3 w-full border-[#c8d9aa] bg-[#f0f5e8] text-[#3f532c] hover:bg-[#e3edd4]"
          >
            {searchingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isVenue ? "Vezi toți producătorii" : "Caută alte lead-uri"}
          </Button>
        ) : null}
      </div>
      {mapAndList}
    </aside>
  );
}
export default LeadMapPanel;
