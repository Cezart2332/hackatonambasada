import React, { useEffect, useState } from "react";
import { Search, Loader2, Navigation, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { messageFromUnknownError } from "@/lib/errors";
import type { LocationChoice } from "@/lib/types";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export function LocationSearch({
  value,
  selectedLocation,
  onChange,
}: {
  value: string;
  selectedLocation?: LocationChoice;
  onChange: (value: string, locationChoice?: LocationChoice) => void;
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = value.trim();

    if (query.length < 3 || selectedLocation?.label === query) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError("");

      api
        .geoSearch(`${query}, România`)
        .then((results) => {
          setSuggestions(results);
          setLoading(false);
        })
        .catch((fetchError: unknown) => {
          if (fetchError instanceof Error && fetchError.name === "AbortError") return;
          setError(
            messageFromUnknownError(
              fetchError,
              "Căutarea localității nu a mers acum. Poți scrie localitatea manual."
            )
          );
          setSuggestions([]);
          setLoading(false);
        });
    }, 420);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [selectedLocation?.label, value]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pl-11 pr-11"
          placeholder="Caută localitatea, ex: Babadag"
        />
        {loading ? (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {selectedLocation ? (
        <div className="flex items-start gap-2 rounded-2xl border border-[#c8d9aa] bg-[#e8f0d7] p-3 text-sm text-[#405235]">
          <Navigation className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Localizat: {selectedLocation.label} · {Number(selectedLocation.lat).toFixed(3)},{" "}
            {Number(selectedLocation.lon).toFixed(3)}
          </span>
        </div>
      ) : null}

      {suggestions.length ? (
        <div className="overflow-hidden rounded-2xl border border-[#ded5bf] bg-white">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => {
                onChange(suggestion.display_name, {
                  label: suggestion.display_name,
                  lat: suggestion.lat,
                  lon: suggestion.lon,
                });
                setSuggestions([]);
              }}
              className="flex w-full items-start gap-2 border-b border-[#eee5d1] px-3 py-3 text-left text-sm last:border-b-0 hover:bg-[#fff9eb]"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#526b36]" />
              <span className="line-clamp-2">{suggestion.display_name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-xs font-semibold text-[#884636]">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Căutare localitate prin Nominatim / OpenStreetMap.</p>
    </div>
  );
}
