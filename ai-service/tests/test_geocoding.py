from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app import db, geocode
from app.agent import discovery_graph
from app.gemini import BuyerDraft, _parse_buyer_item
from app.geocode import GeocodeResult
from app.services import compatibility, discovery
from app.services.compatibility import buyer_is_compatible_with_producer


class GeocodingTests(unittest.TestCase):
    def setUp(self) -> None:
        geocode._geocode_success_cache.clear()
        geocode._nominatim_blocked_until = 0.0
        compatibility._compatibility_cache.clear()
        self._compat_settings_active = True
        self._compat_settings_patcher = patch(
            "app.services.compatibility.get_settings",
            return_value=SimpleNamespace(llm_enabled=False),
        )
        self._compat_settings_patcher.start()
        self.addCleanup(self._stop_compat_settings_patch)

    def _stop_compat_settings_patch(self) -> None:
        if getattr(self, "_compat_settings_active", False):
            self._compat_settings_patcher.stop()
            self._compat_settings_active = False

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

    def test_mall_and_semicolon_address_gets_clean_geocode_variants(self) -> None:
        queries = geocode._build_geocode_queries(
            "Cofetăria Sisters' Bakery",
            "Zona Food Court- vis-a-vis de Farmacia Tei, Vivo Shopping Center, Constanța; "
            "B.P. Hasdeu Nr. 103 (intersectie cu Soveja), Constanța",
            "Constanța",
        )

        self.assertIn(
            "Cofetăria Sisters' Bakery, Vivo Shopping Center, Constanța, Romania",
            queries,
        )
        self.assertIn("Vivo Shopping Center, Constanța, Romania", queries)
        self.assertIn(
            "Cofetăria Sisters' Bakery, Strada B.P. Hasdeu 103, Constanța, Romania",
            queries,
        )

    def test_parenthetical_multi_location_streets_are_kept(self) -> None:
        queries = geocode._build_geocode_queries(
            "Patiseria Efe",
            "Constanța, Medgidia sau Năvodari (locații multiple, adrese specifice pentru promoții: "
            "Str. Stefan cel Mare, Bd. Tomis, Bd. Al. Lăpușneanu, Str. Liliacului)",
            "Constanța",
        )

        self.assertIn("Patiseria Efe, Strada Stefan cel Mare, Constanța, Romania", queries)
        self.assertIn("Patiseria Efe, Bulevardul Tomis, Constanța, Romania", queries)
        self.assertIn("Patiseria Efe, Bulevardul Al. Lăpușneanu, Constanța, Romania", queries)

    def test_geocode_business_tries_cleaned_multisite_query(self) -> None:
        calls: list[str] = []

        def fake_geocode_query(query: str, locality: str | None = None) -> GeocodeResult | None:
            calls.append(query)
            if query == "Vivo Shopping Center, Constanța, Romania":
                return GeocodeResult(
                    latitude=44.211,
                    longitude=28.618,
                    label="VIVO! Constanța, România",
                    query=query,
                )
            return None

        with patch("app.geocode.geocode_query", side_effect=fake_geocode_query):
            result = geocode.geocode_business(
                "Cofetăria Sisters' Bakery",
                "Zona Food Court- vis-a-vis de Farmacia Tei, Vivo Shopping Center, Constanța; "
                "B.P. Hasdeu Nr. 103, Constanța",
                "Constanța",
            )

        self.assertIsNotNone(result)
        self.assertEqual(result.query, "Vivo Shopping Center, Constanța, Romania")
        self.assertNotIn(
            "Zona Food Court- vis-a-vis de Farmacia Tei, Vivo Shopping Center, Constanța; B.P. Hasdeu 103, Romania",
            calls,
        )

    def test_county_prefix_is_stripped_from_queries(self) -> None:
        queries = geocode._build_geocode_queries(
            "La Grisha",
            "Str. Primăverii, nr. 2, Ghindărești, Județul Constanța, Romania",
            "Ghindărești",
        )
        self.assertIn("La Grisha, Strada Primăverii, 2, Ghindărești, Constanța, Romania", queries)
        self.assertIn("Strada Primăverii, 2, Ghindărești, Constanța, Romania", queries)
        self.assertTrue(all("Județul" not in query for query in queries))
        self.assertTrue(all("județul" not in query for query in queries))

    def test_address_needs_enrichment_for_vague_addresses(self) -> None:
        from app.agent.discovery_graph import _address_needs_enrichment
        self.assertTrue(_address_needs_enrichment("Constanța, Romania", "Constanța"))
        self.assertTrue(_address_needs_enrichment("Constanţa, RO", "Constanța"))
        self.assertTrue(_address_needs_enrichment("Județul Constanța, România", "Constanța"))
        self.assertTrue(_address_needs_enrichment("Ghindărești", "Ghindărești"))
        self.assertFalse(_address_needs_enrichment("Strada Primăverii, nr. 2, Ghindărești", "Ghindărești"))
        self.assertFalse(_address_needs_enrichment("Bulevardul Tomis, 49A, Constanța", "Constanța"))

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
            "website": "https://restaurant-test.ro",
            "needs": ["vegetables"],
            "summary": "Restaurant local.",
            "source_urls": ["https://restaurant-test.ro"],
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
            "website": "https://restaurant-local.ro",
            "needs": ["vegetables"],
            "summary": "Restaurant local.",
            "source_urls": ["https://restaurant-local.ro"],
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

    def test_discovery_graph_uses_separate_category_prompts(self) -> None:
        prompts: list[str] = []

        def fake_chat(prompt: str, use_web_tools: bool = True, json_mode: bool = True):
            prompts.append(prompt)
            return SimpleNamespace(text="[]", citations=[])

        state = {
            "locality": "Dobrogea",
            "latitude": 44.17,
            "longitude": 28.63,
            "range_km": 35.0,
            "producer_needs": ["vegetables"],
            "exclude_names": [],
            "avoid_labels": [],
            "target_count": 8,
            "attempts": 0,
            "research_text": "",
            "citations": [],
            "validated": [],
            "seen_names": [],
        }

        with patch("app.agent.discovery_graph.chat_with_web", side_effect=fake_chat):
            first = discovery_graph.search_node(state)
            second = discovery_graph.search_node({**state, "attempts": first["attempts"]})

        self.assertIn("Categoria acestei runde: RESTAURANTE.", prompts[0])
        self.assertIn("Include doar: restaurante", prompts[0])
        self.assertIn("Categoria acestei runde: HOTELURI ȘI PENSIUNI.", prompts[1])
        self.assertIn("Dovada preferată", prompts[1])

    def test_discovery_graph_runs_through_all_categories_before_ending(self) -> None:
        state = {
            "validated": [],
            "target_count": 8,
            "attempts": discovery_graph.MAX_ATTEMPTS - 1,
        }

        self.assertEqual(discovery_graph.route_after_validate(state), "search")
        self.assertEqual(
            discovery_graph.route_after_validate({**state, "attempts": discovery_graph.MAX_ATTEMPTS}),
            "end",
        )

    def test_carmangerie_is_not_compatible_with_vegetable_producer_when_ai_unavailable(self) -> None:
        self.assertFalse(
            buyer_is_compatible_with_producer(
                name="Carmangeria Dobrogea",
                business_type="magazin alimentar",
                producer_needs=["vegetables", "fruit"],
                buyer_needs=["vegetables"],
                summary="Carmangerie și mezelărie locală.",
            )
        )

    def test_carmangerie_is_compatible_with_meat_producer_when_ai_unavailable(self) -> None:
        self.assertTrue(
            buyer_is_compatible_with_producer(
                name="Carmangeria Dobrogea",
                business_type="carmangerie",
                producer_needs=["meat"],
                buyer_needs=["meat"],
                summary="Magazin specializat în carne.",
            )
        )

    def test_ai_compatibility_decision_overrides_fallback(self) -> None:
        self._stop_compat_settings_patch()
        fake_response = SimpleNamespace(text='{"compatible": false, "reason": "local vegan"}')

        with (
            patch("app.services.compatibility.get_settings", return_value=SimpleNamespace(llm_enabled=True)),
            patch("app.services.compatibility.chat_with_web", return_value=fake_response) as chat,
        ):
            self.assertFalse(
                buyer_is_compatible_with_producer(
                    name="Restaurant Verde",
                    business_type="restaurant",
                    producer_needs=["meat"],
                    buyer_needs=["meat"],
                    summary="Restaurant generalist cu meniu mixt.",
                )
            )

        chat.assert_called_once()

    def test_discovery_graph_skips_carmangerie_for_vegetable_producer(self) -> None:
        item = {
            "name": "Carmangeria Dobrogea",
            "type": "magazin alimentar",
            "city": "Constanța",
            "address": "Bulevardul Tomis 100, Constanța, România",
            "needs": ["vegetables"],
            "summary": "Magazin axat pe carne.",
        }
        state = {
            "locality": "Constanța",
            "latitude": 44.17,
            "longitude": 28.63,
            "range_km": 35.0,
            "producer_needs": ["vegetables", "fruit"],
            "exclude_names": [],
            "avoid_labels": [],
            "target_count": 3,
            "attempts": 1,
            "research_text": json.dumps([item]),
            "citations": [],
            "validated": [],
            "seen_names": [],
        }

        with (
            patch("app.agent.discovery_graph.buyer_is_compatible_with_producer", return_value=False),
            patch("app.agent.discovery_graph.geocode_business") as geocode_business,
        ):
            result = discovery_graph.extract_validate_node(state)

        self.assertEqual(result["validated"], [])
        geocode_business.assert_not_called()

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

    def test_market_is_not_accepted_as_buyer_venue(self) -> None:
        item = {
            "name": "Piața Griviței Constanța",
            "type": "piață agroalimentară",
            "city": "Constanța",
            "address": "Constanța, România",
            "website": "https://example-market.ro",
            "source_urls": ["https://example-market.ro"],
            "needs": ["vegetables"],
        }

        draft = _parse_buyer_item(
            item,
            locality="Dobrogea",
            latitude=44.17,
            longitude=28.63,
            fallback_urls=[],
            research_text="",
        )

        self.assertIsNone(draft)

    def test_news_article_url_is_dropped_but_venue_can_still_be_accepted(self) -> None:
        item = {
            "name": "Restaurant Pontica",
            "type": "restaurant",
            "city": "Constanța",
            "address": "Strada Unirii 29, Constanța, România",
            "website": "https://ziuaconstanta.ro/stiri/restaurant-din-articol.html",
            "source_urls": ["https://ziuaconstanta.ro/stiri/restaurant-din-articol.html"],
            "needs": ["vegetables"],
        }

        draft = _parse_buyer_item(
            item,
            locality="Dobrogea",
            latitude=44.17,
            longitude=28.63,
            fallback_urls=[],
            research_text="",
        )

        self.assertIsNotNone(draft)
        self.assertEqual(draft.website, "")
        self.assertEqual(draft.source_urls, [])

    def test_venue_without_links_is_accepted_for_geocoding(self) -> None:
        item = {
            "name": "Restaurant Fără Site",
            "type": "restaurant",
            "city": "Constanța",
            "address": "Strada Unirii 29, Constanța, România",
            "needs": ["cheese"],
            "summary": "Venue real găsit cu adresă publică.",
        }

        draft = _parse_buyer_item(
            item,
            locality="Dobrogea",
            latitude=44.17,
            longitude=28.63,
            fallback_urls=[],
            research_text="",
        )

        self.assertIsNotNone(draft)
        self.assertEqual(draft.website, "")
        self.assertEqual(draft.source_urls, [])

    def test_google_maps_is_relevant_source_but_not_website(self) -> None:
        maps_url = "https://www.google.com/maps/place/Restaurant+Bueno"
        item = {
            "name": "Restaurant Bueno",
            "type": "restaurant",
            "city": "Constanța",
            "address": "Bulevardul Tomis 55, Constanța, România",
            "website": maps_url,
            "source_urls": [maps_url, "https://ziuaconstanta.ro/stiri/restaurant-bueno.html"],
            "needs": ["vegetables", "cheese"],
            "summary": "Venue activ cu adresă publică.",
        }

        draft = _parse_buyer_item(
            item,
            locality="Dobrogea",
            latitude=44.17,
            longitude=28.63,
            fallback_urls=[],
            research_text="",
        )

        self.assertIsNotNone(draft)
        self.assertEqual(draft.website, "")
        self.assertEqual(draft.source_urls, [maps_url])

    def test_official_venue_website_is_accepted(self) -> None:
        item = {
            "name": "Restaurant Bueno",
            "type": "restaurant",
            "city": "Constanța",
            "address": "Bulevardul Tomis 55, Constanța, România",
            "website": "https://www.restaurantbueno.ro/restaurant-bueno-constanta/",
            "source_urls": ["https://www.restaurantbueno.ro/restaurant-bueno-constanta/"],
            "needs": ["vegetables", "cheese"],
            "summary": "Venue activ cu meniu public.",
        }

        draft = _parse_buyer_item(
            item,
            locality="Dobrogea",
            latitude=44.17,
            longitude=28.63,
            fallback_urls=[],
            research_text="",
        )

        self.assertIsNotNone(draft)
        self.assertEqual(draft.website, "https://www.restaurantbueno.ro/restaurant-bueno-constanta/")


if __name__ == "__main__":
    unittest.main()
