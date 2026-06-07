import type { Lead, LeadStatus } from "@/lib/types";

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-[#5a7150]">{label}</p>
      <p className="font-semibold text-[#263421]">{value}</p>
    </div>
  );
}

export function VenueStatsHeader({
  leads,
  statuses,
}: {
  leads: Lead[];
  statuses: Record<string, LeadStatus>;
}) {
  const contacted = Object.values(statuses).filter((s) => s === "Contactat" || s === "A răspuns" || s === "A cumpărat").length;
  const rejected = Object.values(statuses).filter((s) => s === "Nu e potrivit").length;

  return (
    <div className="grid gap-2 rounded-xl border border-[#d7e4c4] bg-[#f4f8ee] px-3 py-1.5 text-xs sm:grid-cols-2 sm:text-sm">
      <StatPill
        label="Potriviți"
        value={rejected ? `${leads.length} în listă · ${rejected} respinși` : `${leads.length} în listă`}
      />
      <StatPill label="Contact" value={`${contacted} contactați / răspuns`} />
    </div>
  );
}
