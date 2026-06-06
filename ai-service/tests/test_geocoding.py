from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app import db, geocode
from app.agent import discovery_graph
from app.gemini import BuyerDraft
from app.geocode import GeocodeResult
from app.services import discovery


class GeocodingTests(unittest.TestCase):
    def setUp(self) -> None:
        geocode._geocode_success_cache.clear()
        geocode._nominatim_blocked_until = 0.0

    def test_full_address_query_is_sent_before_name_only_fallback(self) -> None:
        calls: list[str] = []

        def fake_geocode_query(query: str, locality: str | None = None) -> GeocodeResult | None:
            calls.append(query)
            return GeocodeResult(
                latitude=44.176,
                longitude=28.653,
                label="Bd. Tomis 49A, Constanța, România",
                query=query,
            )

        with patch("app.geocode.geocode_query", side_effect=fake_geocode_query):
            result = geocode.geocode_business(
                "Lupa by Bueno",
                "Bd. Tomis 49A, Constanța, România",
                "Constanța",
            )

        self.assertIsNotNone(result)
        self.assertEqual(calls[0], "Lupa by Bueno, Bulevardul Tomis 49A, Constanța, Romania")

    def test_locality_with_country_does_not_duplicate_city_or_country(self) -> None:
        queries = geocode._build_geocode_queries(
            "Restaurant Bueno",
            "Bulevardul Tomis 55, Constanța 900178, Romania",
            "Constanța, România",
        )

        self.assertEqual(
            queries[:2],
            [
                "Restaurant Bueno, Bulevardul Tomis 55, Constanța, Romania",
                "Bulevardul Tomis 55, Constanța, Romania",
            ],
        )
        self.assertTrue(all("Constanța, Constanța" not in query for query in queries))
        self.assertTrue(all("Romania, Romania" not in query for query in queries))

    def test_bare_street_name_gets_street_variant(self) -> None:
        queries = geocode._build_geocode_queries(
            "Cosa Ristorante",
            "Unirii 29, Constanța, România",
            "Constanța, România",
        )

        self.assertIn("Cosa Ristorante, Strada Unirii 29, Constanța, Romania", queries)
        self.assertIn("Strada Unirii 29, Constanța, Romania", queries)

    def test_wrong_city_result_is_rejected_for_specific_locality(self) -> None:
        result = geocode._pick_romania_result(
            [
                {
                    "lat": "44.0672218",
                    "lon": "28.6312967",
                    "class": "building",
                    "type": "yes",
                    "display_name": "29, Strada Mihail Kogălniceanu, Eforie Nord, Constanța, România",
                    "address": {
                        "house_number": "29",
                        "road": "Strada Mihail Kogălniceanu",
                        "town": "Eforie Nord",
                        "county": "Constanța",
                        "country": "România",
                    },
                }
            ],
            "Strada Mihail Kogălniceanu 29, Constanța, Romania",
            "Constanța, România",
        )

        self.assertIsNone(result)

    def test_dobrogea_region_uses_city_from_address_not_constanta(self) -> None:
        queries = geocode._build_geocode_queries(
            "Cherhanaua Sailors",
            "Portul Belona, Eforie Nord, Constanța, România",
            "Dobrogea",
        )

        self.assertIn("Cherhanaua Sailors, Portul Belona, Eforie Nord, Constanța, Romania", queries)
        self.assertIn("Cherhanaua Sailors, Eforie Nord, Romania", queries)
        self.assertTrue(all("Constanța, Constanța" not in query for query in queries))

    def test_city_county_address_infers_first_locality(self) -> None:
        self.assertEqual(
            geocode.infer_city_from_address("Jurilovca, Tulcea, România"),
            "Jurilovca",
        )

    def test_ai_city_overrides_producer_region(self) -> None:
        calls: list[tuple[str, str | None]] = []

        def fake_geocode_query(query: str, locality: str | None = None) -> GeocodeResult | None:
            calls.append((query, locality))
            return GeocodeResult(
                latitude=44.064,
                longitude=28.633,
                label="Eforie Nord, România",
                query=query,
            )

        with patch("app.geocode.geocode_query", side_effect=fake_geocode_query):
            result = geocode.geocode_business(
                "Cherhanaua Sailors",
                "Portul Belona, Eforie Nord, Constanța, România",
                "Eforie Nord",
            )

        self.assertIsNotNone(result)
        self.assertEqual(calls[0][1], "Eforie Nord")
        self.assertIn("Eforie Nord", calls[0][0])

    def test_locality_level_result_is_rejected(self) -> None:
        result = geocode._pick_romania_result(
            [
                {
                    "lat": "44.1733",
                    "lon": "28.6383",
                    "class": "place",
                    "type": "city",
                    "place_rank": 16,
                    "display_name": "Constanța, România",
                    "address": {"city": "Constanța", "country": "România"},
                }
            ],
            "Constanța, Romania",
        )

        self.assertIsNone(result)

    def test_approximate_fallback_is_not_returned(self) -> None:
        with patch("app.geocode.geocode_query", return_value=None):
            result = geocode.geocode_business(
                "Unknown Business",
                "Constanța",
                "Constanța",
                fallback_lat=44.17,
                fallback_lon=28.63,
            )

        self.assertIsNone(result)

    def test_out_of_radius_geocode_result_is_rejected_by_discovery_graph(self) -> None:
        item = {
            "name": "Restaurant Test",
            "type": "restaurant",
            "address": "Strada Testului 10, Constanța, România",
            "needs": ["vegetables"],
            "summary": "Restaurant local.",
            "source_urls": ["https://example.com/restaurant-test"],
        }
        state = {
            "locality": "Constanța",
            "latitude": 44.17,
            "longitude": 28.63,
            "range_km": 1.0,
            "producer_needs": ["vegetables"],
            "exclude_names": [],
            "avoid_labels": [],
            "target_count": 3,
            "attempts": 1,
            "research_text": json.dumps([item]),
            "citations": [],
            "validated": [],
            "seen_names": [],
        }

        far_result = GeocodeResult(
            latitude=44.90,
            longitude=28.10,
            label="Far away",
            query="Restaurant Test, Strada Testului 10, Constanța, Romania",
        )
        with patch("app.agent.discovery_graph.geocode_business", return_value=far_result):
            result = discovery_graph.extract_validate_node(state)

        self.assertEqual(result["validated"], [])

    def test_city_center_fallback_is_used_when_business_geocode_fails(self) -> None:
        item = {
            "name": "Restaurant Local",
            "type": "restaurant",
            "address": "Constanța, România",
            "city": "Constanța",
            "needs": ["vegetables"],
            "summary": "Restaurant local.",
            "source_urls": ["https://example.com/restaurant-local"],
        }
        state = {
            "locality": "Constanța",
            "latitude": 44.17,
            "longitude": 28.63,
            "range_km": 35.0,
            "producer_needs": ["vegetables"],
            "exclude_names": [],
            "avoid_labels": [],
            "target_count": 3,
            "attempts": 1,
            "research_text": json.dumps([item]),
            "citations": [],
            "validated": [],
            "seen_names": [],
        }

        city_result = GeocodeResult(
            latitude=44.176,
            longitude=28.653,
            label="Constanța, România",
            query="Constanța, Romania",
            status="city_center",
        )
        with (
            patch("app.agent.discovery_graph.geocode_business", return_value=None),
            patch("app.agent.discovery_graph.geocode_city_center", return_value=city_result),
        ):
            result = discovery_graph.extract_validate_node(state)

        self.assertEqual(len(result["validated"]), 1)
        self.assertEqual(result["validated"][0].geocode_status, "city_center")

    def test_verified_geocode_metadata_is_passed_to_upsert(self) -> None:
        draft = BuyerDraft(
            name="Restaurant Verified",
            type="restaurant",
            city="Constanța",
            address="Bd. Tomis 49A, Constanța, România",
            latitude=44.176,
            longitude=28.653,
            needs=["vegetables"],
            summary="Restaurant local.",
            contact="Salut",
            geocode_provider="nominatim",
            geocode_status="verified",
            geocode_query="Restaurant Verified, Bd. Tomis 49A, Constanța, Romania",
            geocode_label="Bd. Tomis 49A, Constanța, România",
        )

        with (
            patch("app.services.discovery.get_settings", return_value=SimpleNamespace(llm_enabled=False)),
            patch("app.services.discovery.db.ensure_area_exists"),
            patch("app.services.discovery.db.mark_area_researched") as mark_area,
            patch("app.services.discovery.db.upsert_buyer") as upsert,
        ):
            persisted = discovery._persist_drafts(
                area_key="constanta:44.2:28.6",
                locality="Constanța",
                latitude=44.17,
                longitude=28.63,
                radius_km=35,
                drafts=[draft],
            )

        self.assertEqual(persisted, 1)
        upsert_kwargs = upsert.call_args.kwargs
        self.assertEqual(upsert_kwargs["geocode_status"], "verified")
        self.assertEqual(upsert_kwargs["geocode_provider"], "nominatim")
        self.assertEqual(upsert_kwargs["geocode_query"], draft.geocode_query)
        self.assertEqual(upsert_kwargs["geocode_label"], draft.geocode_label)
        mark_area.assert_called_once()

    def test_cache_check_rejects_old_rows_without_verified_geocode_status(self) -> None:
        old_rows = [
            {
                "latitude": 44.18,
                "longitude": 28.64,
                "geocode_status": "unknown",
            }
        ]

        with patch("app.db.list_buyers_in_area", return_value=old_rows):
            self.assertFalse(db.area_has_geocoded_data("constanta:44.2:28.6", 44.17, 28.63, 35))


if __name__ == "__main__":
    unittest.main()
