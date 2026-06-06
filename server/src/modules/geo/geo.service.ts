import { AppError } from "../../shared/errors/AppError.js";

export type GeoResult = {
  label: string;
  latitude: number;
  longitude: number;
};

export async function searchLocations(query: string): Promise<GeoResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "8");
  url.searchParams.set("countrycodes", "ro");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "WarmLeadsHackathon/1.0 (contact@warmleads.local)",
    },
  });

  if (!response.ok) {
    throw new AppError("Căutarea localității a eșuat. Încearcă din nou sau scrie localitatea manual.", 502, "GEO_SEARCH_FAILED");
  }

  const data = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return data.map((item) => ({
    label: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  }));
}