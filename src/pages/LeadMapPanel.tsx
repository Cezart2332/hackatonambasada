import React, { type ComponentType } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
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
import type { Lead, LeadStatus } from "@/lib/types";

const LeafletMapContainer = MapContainer as unknown as ComponentType<Record<string, unknown>>;
const LeafletCircleMarker = CircleMarker as unknown as ComponentType<Record<string, unknown>>;

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
}: {
  lead: Lead;
  status?: LeadStatus;
  failedFeedback?: string;
  onDetails: (lead: Lead) => void;
  onMessage: (lead: Lead) => void;
  onStatus: (lead: Lead, status: LeadStatus) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onFailedClick: (lead: Lead) => void;
}) {
  const Icon = leadIcon(lead.icon);

  return (
    <div className={cn(
      "rounded-2xl border p-3 transition-colors",
      failedFeedback ? "border-[#ead2cc] bg-[#fffcfb]" : "border-[#ded5bf] bg-[#fffdf7]"
    )}>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e9f0dc] text-[#4d6638]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-[#263421]">{lead.name}</p>
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
            Îl recomand pentru că {lead.reason}
          </p>

          {failedFeedback ? (
            <div className="mt-2 text-xs font-semibold text-[#884636] bg-[#fae8e4] border border-[#ead2cc] rounded-xl p-2 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#884636] mt-0.5" />
              <span>Contact eșuat: {failedFeedback}</span>
            </div>
          ) : null}

          {status ? (
            <div className="mt-2">
              <StatusBadge status={status} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onDetails(lead)}>
          Detalii
        </Button>
        <Button type="button" variant="honey" size="sm" onClick={() => onMessage(lead)}>
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
          onClick={() => onFailedClick(lead)}
          className="text-rose-700 hover:bg-rose-50 border-rose-200 hover:border-rose-300"
        >
          Ceva n-a mers
        </Button>
      </div>
    </div>
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
}) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-[#fbf7ed]">
      <div className="shrink-0 border-b border-[#d7ccb3] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-extrabold text-[#263421]">Hartă lead-uri</p>
            <p className="text-sm text-muted-foreground">
              POI-uri cu restaurante, hoteluri și băcănii din Dobrogea.
            </p>
          </div>
          <Badge variant="warm">{activeLeadCount} active</Badge>
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
            Caută alte lead-uri
          </Button>
        ) : null}
      </div>

      <div className="h-[280px] shrink-0 border-b border-[#d7ccb3] lg:h-[42%]">
        <LeafletMapContainer
          center={[44.13, 28.62]}
          zoom={9}
          scrollWheelZoom={false}
          className="h-full w-full"
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
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
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
export default LeadMapPanel;
