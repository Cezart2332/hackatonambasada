import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { Lead, LeadStatus } from "@/lib/types";
import type { VenueMatchDiagnostics } from "@/lib/venueChatUtils";

export function useVenueProducers() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<Record<string, LeadStatus>>({});
  const [venueProducerScope, setVenueProducerScope] = useState<"matched" | "all">("matched");
  const [lastDiagnostics, setLastDiagnostics] = useState<VenueMatchDiagnostics | undefined>();

  const loadVenueProducers = useCallback(
    async (scope: "matched" | "all" = venueProducerScope, needs = "") => {
      const { producers, diagnostics } = await api.listMatchedProducers(scope, needs || undefined);
      setLeads(producers);
      setLastDiagnostics(diagnostics);
      const statuses: Record<string, LeadStatus> = {};
      for (const producer of producers) {
        if (producer.status) statuses[producer.id] = producer.status;
      }
      setLeadStatuses(statuses);
      return { producers, diagnostics };
    },
    [venueProducerScope],
  );

  return {
    leads,
    setLeads,
    leadStatuses,
    setLeadStatuses,
    venueProducerScope,
    setVenueProducerScope,
    lastDiagnostics,
    loadVenueProducers,
  };
}
