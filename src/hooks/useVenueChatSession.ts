import { useCallback, useEffect, useState } from "react";
import {
  clearVenueSessionStorage,
  EMPTY_VENUE_SESSION,
  readVenueSessionFromStorage,
  type VenueChatSession,
  writeVenueSessionToStorage,
} from "@/lib/venueChatUtils";

export function useVenueChatSession(userId: string | null) {
  const [session, setSession] = useState<VenueChatSession>(EMPTY_VENUE_SESSION);

  const hydrate = useCallback((id: string) => {
    setSession(readVenueSessionFromStorage(id));
  }, []);

  const reset = useCallback((id?: string | null) => {
    setSession({ ...EMPTY_VENUE_SESSION });
    if (id) clearVenueSessionStorage(id);
  }, []);

  const updateSession = useCallback(
    (patch: Partial<VenueChatSession>) => {
      setSession((current) => {
        const next = { ...current, ...patch };
        if (userId) writeVenueSessionToStorage(userId, next);
        return next;
      });
    },
    [userId],
  );

  useEffect(() => {
    if (userId) hydrate(userId);
  }, [userId, hydrate]);

  return {
    session,
    needs: session.needs,
    supplyFrequency: session.supplyFrequency,
    preferredDays: session.preferredDays,
    setNeeds: (needs: string) => updateSession({ needs }),
    setSupplyFrequency: (supplyFrequency: string) => updateSession({ supplyFrequency }),
    setPreferredDays: (preferredDays: string) => updateSession({ preferredDays }),
    updateSession,
    hydrate,
    reset,
  };
}
