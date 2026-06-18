from __future__ import annotations

import json
import math
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple

import requests

Point = Tuple[float, float]  # (latitude, longitude)

MAPPLS_DIRECTION_BASE = "https://apis.mappls.com/advancedmaps/v1"
EARTH_RADIUS_KM = 6371.0


# --------------------------------------------------------------------------- #
# Geometry helpers
# --------------------------------------------------------------------------- #

def haversine_km(p1: Point, p2: Point) -> float:
    """Great-circle distance between two (lat, lon) points, in km."""
    lat1, lon1 = map(math.radians, p1)
    lat2, lon2 = map(math.radians, p2)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def initial_bearing_deg(p1: Point, p2: Point) -> float:
    """Initial compass bearing (degrees, 0-360) travelling from p1 to p2."""
    lat1, lon1 = map(math.radians, p1)
    lat2, lon2 = map(math.radians, p2)
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def destination_point(start: Point, bearing_deg: float, distance_km: float) -> Point:
    """Point reached by travelling distance_km from start along bearing_deg."""
    lat1, lon1 = map(math.radians, start)
    brng = math.radians(bearing_deg)
    delta = distance_km / EARTH_RADIUS_KM

    lat2 = math.asin(
        math.sin(lat1) * math.cos(delta)
        + math.cos(lat1) * math.sin(delta) * math.cos(brng)
    )
    lon2 = lon1 + math.atan2(
        math.sin(brng) * math.sin(delta) * math.cos(lat1),
        math.cos(delta) - math.sin(lat1) * math.sin(lat2),
    )
    return (math.degrees(lat2), (math.degrees(lon2) + 540) % 360 - 180)


def decode_polyline(encoded: str, precision: int = 5) -> List[Point]:
    """Decode an OSRM/Google-style encoded polyline into a list of (lat, lon)."""
    factor = 10 ** precision
    coordinates: List[Point] = []
    index = lat = lon = 0
    length = len(encoded)

    while index < length:
        for is_lat in (True, False):
            shift = result = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            delta = ~(result >> 1) if (result & 1) else (result >> 1)
            if is_lat:
                lat += delta
            else:
                lon += delta
        coordinates.append((lat / factor, lon / factor))

    return coordinates


def _clip(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def distance_point_to_segment_km(p: Point, a: Point, b: Point) -> float:
    """
    Approximate shortest distance from point p to the line segment a->b, in km.
    Good enough for city-scale route scoring and far simpler than full geodesic
    projection logic.
    """
    if a == b:
        return haversine_km(p, a)

    # Local equirectangular projection around the segment midpoint.
    lat0 = math.radians((a[0] + b[0] + p[0]) / 3.0)
    lon0 = math.radians((a[1] + b[1]) / 3.0)

    def to_xy(pt: Point) -> Tuple[float, float]:
        lat, lon = map(math.radians, pt)
        x = (lon - lon0) * math.cos(lat0) * EARTH_RADIUS_KM
        y = (lat - lat0) * EARTH_RADIUS_KM
        return x, y

    px, py = to_xy(p)
    ax, ay = to_xy(a)
    bx, by = to_xy(b)

    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    ab2 = abx * abx + aby * aby
    if ab2 == 0:
        return math.hypot(apx, apy)

    t = _clip((apx * abx + apy * aby) / ab2, 0.0, 1.0)
    cx = ax + t * abx
    cy = ay + t * aby
    return math.hypot(px - cx, py - cy)


def min_distance_to_point_km(path: List[Point], point: Point) -> float:
    if not path:
        return float("inf")
    return min(haversine_km(c, point) for c in path)


# --------------------------------------------------------------------------- #
# Data classes
# --------------------------------------------------------------------------- #

@dataclass
class Incident:
    """
    Event geometry:
      - latitude / longitude: event start
      - end_latitude / end_longitude: event end (same as start for point events)
    """

    latitude: float
    longitude: float
    affected_radius_km: float
    duration_minutes: float
    end_latitude: Optional[float] = None
    end_longitude: Optional[float] = None
    severity: Optional[str] = None
    congestion_impact_score: Optional[float] = None
    corridor: Optional[str] = None
    junction: Optional[str] = None

    @property
    def start_point(self) -> Point:
        return (float(self.latitude), float(self.longitude))

    @property
    def end_point(self) -> Point:
        if self.end_latitude is None or self.end_longitude is None:
            return self.start_point
        return (float(self.end_latitude), float(self.end_longitude))

    @property
    def is_point_event(self) -> bool:
        return self.start_point == self.end_point

    @property
    def anchor_point(self) -> Point:
        """Single representative point for the event footprint."""
        if self.is_point_event:
            return self.start_point
        lat1, lon1 = self.start_point
        lat2, lon2 = self.end_point
        return ((lat1 + lat2) / 2.0, (lon1 + lon2) / 2.0)

    @property
    def segment_length_km(self) -> float:
        return haversine_km(self.start_point, self.end_point)

    def distance_to_km(self, p: Point) -> float:
        """Distance from p to the event footprint."""
        if self.is_point_event:
            return haversine_km(p, self.start_point)
        return distance_point_to_segment_km(p, self.start_point, self.end_point)


@dataclass
class RouteCandidate:
    distance_km: float
    duration_min: float
    path: List[Point]
    raw_geometry: str
    min_distance_to_incident_km: float
    intersects_closure: bool


class MapplsAPIError(RuntimeError):
    pass


# --------------------------------------------------------------------------- #
# Main planner
# --------------------------------------------------------------------------- #

class DiversionPlanner:
    def __init__(
        self,
        access_token: str,
        region: str = "ind",
        session: Optional[requests.Session] = None,
        routing_radius_scale: float = 0.3,
        routing_radius_floor_km: float = 0.25,
        routing_radius_cap_km: float = 0.8,
        point_event_axes: Tuple[int, ...] = (90, 60, 120, 45, 135, 30, 150, 0, 180),
    ):
        self.access_token = access_token
        self.region = region
        self.session = session or requests.Session()
        self.routing_radius_scale = routing_radius_scale
        self.routing_radius_floor_km = routing_radius_floor_km
        self.routing_radius_cap_km = routing_radius_cap_km
        self.point_event_axes = point_event_axes

    # -- low level API call -------------------------------------------------

    def _coords_to_query(self, points: List[Point]) -> str:
        # Mappls expects lon,lat
        return ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in points)

    def fetch_routes(
        self,
        start: Point,
        end: Point,
        via: Optional[List[Point]] = None,
        resource: str = "route_eta",
        profile: str = "driving",
        alternatives: int = 1,
    ) -> Dict[str, Any]:
        """Hit the Mappls REST Direction API and return parsed JSON."""
        waypoints = [start] + (via or []) + [end]
        coord_str = self._coords_to_query(waypoints)
        url = f"{MAPPLS_DIRECTION_BASE}/{self.access_token}/{resource}/{profile}/{coord_str}"

        params = {
            "geometries": "polyline",
            "overview": "full",
            "steps": "false",
            "alternatives": alternatives,
            "region": self.region,
        }

        resp = self.session.get(url, params=params, timeout=15)
        if resp.status_code != 200:
            raise MapplsAPIError(f"Mappls API returned HTTP {resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        if not data.get("routes"):
            raise MapplsAPIError(f"Mappls API returned no routes. Raw response: {json.dumps(data)[:300]}")
        return data

    # -- routing radius -----------------------------------------------------

    def _effective_radius_km(self, incident: Incident) -> float:
        """
        The model's affected_radius is a congestion-impact radius, not always a
        literal hard closure radius. For routing, we use a scaled/clipped radius
        so the diversion engine remains usable in dense urban networks.
        """
        raw = float(incident.affected_radius_km)
        scaled = raw * self.routing_radius_scale
        return max(self.routing_radius_floor_km, min(scaled, self.routing_radius_cap_km))

    # -- route scoring against the incident geofence ------------------------

    def _to_candidate(self, raw_route: Dict[str, Any], incident: Incident) -> RouteCandidate:
        geometry = raw_route["geometry"]
        path = decode_polyline(geometry, precision=5)
        min_dist = min(incident.distance_to_km(c) for c in path) if path else float("inf")
        effective_radius = self._effective_radius_km(incident)
        return RouteCandidate(
            distance_km=raw_route.get("distance", 0) / 1000.0,
            duration_min=raw_route.get("duration", 0) / 60.0,
            path=path,
            raw_geometry=geometry,
            min_distance_to_incident_km=min_dist,
            intersects_closure=min_dist <= effective_radius,
        )

    @staticmethod
    def _local_corridor_bearing(baseline: RouteCandidate, incident: Incident, fallback_start: Point, fallback_end: Point) -> float:
        """
        Bearing of the road near the incident, inferred from the baseline route.
        Falls back to the caller's start/end orientation if the baseline is too short.
        """
        path = baseline.path
        if len(path) < 3:
            return initial_bearing_deg(fallback_start, fallback_end)

        closest_idx = min(range(len(path)), key=lambda i: incident.distance_to_km(path[i]))
        i0 = max(closest_idx - 1, 0)
        i1 = min(closest_idx + 1, len(path) - 1)
        if i0 == i1:
            return initial_bearing_deg(fallback_start, fallback_end)
        return initial_bearing_deg(path[i0], path[i1])

    def _search_via_detour(
        self,
        incident: Incident,
        route_start: Point,
        route_end: Point,
        baseline: RouteCandidate,
        resource: str = "route_eta",
        buffer_km: Optional[float] = None,
        angle_offsets: Tuple[int, ...] = (90, -90, 60, -60, 120, -120, 45, -45, 30, -30),
        distance_multipliers: Tuple[float, ...] = (1.0, 2.0, 3.5, 5.0, 7.0),
        max_attempts: int = 40,
    ) -> Tuple[Optional[RouteCandidate], Optional[Point], List[Dict[str, Any]]]:
        """
        Try a spread of candidate via points (different angles off the local road
        direction, at increasing distances) until one produces a route that
        actually clears the incident's geofence.
        """
        effective_radius = self._effective_radius_km(incident)
        if buffer_km is None:
            buffer_km = max(0.35, effective_radius * 0.6)

        base_bearing = self._local_corridor_bearing(baseline, incident, route_start, route_end)
        attempts: List[Dict[str, Any]] = []
        best: Optional[RouteCandidate] = None
        best_via: Optional[Point] = None
        calls = 0

        for mult in distance_multipliers:
            distance_km = mult * (effective_radius + buffer_km)
            for angle in angle_offsets:
                if calls >= max_attempts:
                    break
                calls += 1
                via_point = destination_point(incident.anchor_point, (base_bearing + angle) % 360, distance_km)

                try:
                    data = self.fetch_routes(route_start, route_end, via=[via_point], resource=resource, alternatives=1)
                except MapplsAPIError:
                    continue

                candidate = self._to_candidate(data["routes"][0], incident)

                via_distance_from_route_km = round(min_distance_to_point_km(candidate.path, via_point), 3)
                via_appears_ignored = via_distance_from_route_km > max(0.3, effective_radius * 0.5)

                wps = data.get("waypoints")
                snap_distance_km = None
                if wps and len(wps) >= 3 and wps[1].get("location"):
                    snap_lon, snap_lat = wps[1]["location"][0], wps[1]["location"][1]
                    snap_distance_km = round(haversine_km(via_point, (snap_lat, snap_lon)), 3)

                attempts.append({
                    "angle_offset": angle,
                    "distance_multiplier": mult,
                    "via_point": {"lat": via_point[0], "lon": via_point[1]},
                    "waypoints_returned": len(wps) if wps else None,
                    "via_distance_from_route_km": via_distance_from_route_km,
                    "via_appears_ignored": via_appears_ignored,
                    "snap_distance_km": snap_distance_km,
                    "min_distance_to_incident_km": round(candidate.min_distance_to_incident_km, 3),
                    "cleared": not candidate.intersects_closure,
                })

                if not candidate.intersects_closure:
                    return candidate, via_point, attempts

                if best is None or candidate.min_distance_to_incident_km > best.min_distance_to_incident_km:
                    best, best_via = candidate, via_point

            if calls >= max_attempts:
                break

        if attempts and sum(1 for a in attempts if a.get("via_appears_ignored")) == len(attempts):
            attempts.append({
                "diagnosis": "via_parameter_may_be_unsupported",
                "detail": (
                    f"All {len(attempts)} via points tried had zero practical effect on the returned route. "
                    f"Check the Mappls resource/token if this repeats."
                ),
            })

        return best, best_via, attempts

    # -- diversion scope derivation ----------------------------------------

    def _derive_route_scope(self, incident: Incident, axis_bearing: Optional[float] = None) -> Tuple[Point, Point, Dict[str, Any]]:
        """
        Create a route origin/destination around the event footprint.

        Segment event:
            origin = before event start
            destination = after event end

        Point event:
            origin/destination are placed on opposite sides of the point along
            a candidate axis bearing.
        """
        effective_radius = self._effective_radius_km(incident)
        scope_buffer_km = max(0.75, effective_radius * 1.2)

        if incident.is_point_event:
            if axis_bearing is None:
                axis_bearing = 90.0
            origin = destination_point(incident.anchor_point, (axis_bearing + 180) % 360, scope_buffer_km)
            destination = destination_point(incident.anchor_point, axis_bearing, scope_buffer_km)
            return origin, destination, {
                "mode": "point_event_local_bypass",
                "axis_bearing": axis_bearing,
                "scope_buffer_km": scope_buffer_km,
            }

        segment_bearing = initial_bearing_deg(incident.start_point, incident.end_point)
        origin = destination_point(incident.start_point, (segment_bearing + 180) % 360, scope_buffer_km)
        destination = destination_point(incident.end_point, segment_bearing, scope_buffer_km)
        return origin, destination, {
            "mode": "segment_bypass",
            "axis_bearing": segment_bearing,
            "scope_buffer_km": scope_buffer_km,
        }

    # -- barricade / manpower point derivation ------------------------------

    def _closure_boundary_points(self, path: List[Point], incident: Incident) -> Dict[str, Optional[Point]]:
        """Walk the baseline path and find where it crosses into/out of the geofence."""
        effective_radius = self._effective_radius_km(incident)
        inside_idx = [i for i, c in enumerate(path) if incident.distance_to_km(c) <= effective_radius]
        if not inside_idx:
            return {"entry": None, "exit": None}
        return {"entry": path[inside_idx[0]], "exit": path[inside_idx[-1]]}

    # -- core planning for one route scope ---------------------------------

    def _build_response(
        self,
        incident: Incident,
        route_start: Point,
        route_end: Point,
        baseline: RouteCandidate,
        chosen: RouteCandidate,
        method: str,
        via_point: Optional[Point],
        scope: Dict[str, Any],
        search_attempts: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        boundary = self._closure_boundary_points(baseline.path, incident)

        barricade_points = []
        if boundary["entry"]:
            barricade_points.append({"label": "closure_entry", "lat": boundary["entry"][0], "lon": boundary["entry"][1]})
        if boundary["exit"]:
            barricade_points.append({"label": "closure_exit", "lat": boundary["exit"][0], "lon": boundary["exit"][1]})

        manpower_points = list(barricade_points)
        if via_point:
            manpower_points.append({"label": "diversion_redirect_point", "lat": via_point[0], "lon": via_point[1]})

        effective_radius = self._effective_radius_km(incident)
        diversion: Dict[str, Any] = {
            "method": method,  # none_required | alternative_route | forced_via_detour | forced_via_detour_partial
            "manual_review_required": method == "forced_via_detour_partial",
            "predicted_radius_km": round(float(incident.affected_radius_km), 3),
            "routing_radius_km": round(effective_radius, 3),
            "distance_km": round(chosen.distance_km, 2),
            "duration_min": round(chosen.duration_min, 1),
            "extra_distance_km": round(chosen.distance_km - baseline.distance_km, 2),
            "extra_time_min": round(chosen.duration_min - baseline.duration_min, 1),
            "still_intersects_closure": chosen.intersects_closure,
            "via_point": {"lat": via_point[0], "lon": via_point[1]} if via_point else None,
            "path": [{"lat": lat, "lon": lon} for lat, lon in chosen.path],
        }
        if search_attempts is not None:
            diversion["search_attempts"] = search_attempts

        return {
            "incident": asdict(incident),
            "routing_scope": {
                "mode": scope.get("mode"),
                "axis_bearing": scope.get("axis_bearing"),
                "scope_buffer_km": round(float(scope.get("scope_buffer_km", 0.0)), 3),
                "route_start": {"lat": route_start[0], "lon": route_start[1]},
                "route_end": {"lat": route_end[0], "lon": route_end[1]},
            },
            "baseline_route": {
                "distance_km": round(baseline.distance_km, 2),
                "duration_min": round(baseline.duration_min, 1),
                "min_distance_to_incident_km": round(baseline.min_distance_to_incident_km, 3),
                "intersects_closure": baseline.intersects_closure,
            },
            "diversion": diversion,
            "barricade_points": barricade_points,
            "manpower_points": manpower_points,
        }

    def _plan_for_route_scope(
        self,
        incident: Incident,
        route_start: Point,
        route_end: Point,
        scope: Dict[str, Any],
        alternatives: int = 3,
    ) -> Dict[str, Any]:
        """Plan one diversion for a specific route scope."""
        baseline_data = self.fetch_routes(route_start, route_end, resource="route_eta", alternatives=1)
        baseline = self._to_candidate(baseline_data["routes"][0], incident)

        if not baseline.intersects_closure:
            return self._build_response(
                incident,
                route_start,
                route_end,
                baseline,
                baseline,
                method="none_required",
                via_point=None,
                scope=scope,
            )

        alt_data = self.fetch_routes(route_start, route_end, resource="route_eta", alternatives=alternatives)
        candidates = [self._to_candidate(r, incident) for r in alt_data["routes"]]
        clear = [c for c in candidates if not c.intersects_closure]

        if clear:
            best = min(clear, key=lambda c: c.duration_min)
            return self._build_response(
                incident,
                route_start,
                route_end,
                baseline,
                best,
                method="alternative_route",
                via_point=None,
                scope=scope,
            )

        forced, via_point, attempts = self._search_via_detour(incident, route_start, route_end, baseline)
        if forced is None:
            forced, via_point = baseline, None

        method = "forced_via_detour" if not forced.intersects_closure else "forced_via_detour_partial"
        return self._build_response(
            incident,
            route_start,
            route_end,
            baseline,
            forced,
            method=method,
            via_point=via_point,
            scope=scope,
            search_attempts=attempts,
        )

    # -- public entry point -------------------------------------------------

    def generate_plan(self, incident: Incident, alternatives: int = 3) -> Dict[str, Any]:
        """
        Build a diversion plan for the event.

        For a segment event (start != end), the planner tries to bypass the
        blocked corridor.
        For a point event (start == end), it tries a local bypass around the
        incident point using several candidate axes.
        """
        if incident.is_point_event:
            best_plan: Optional[Dict[str, Any]] = None
            best_rank: Optional[Tuple[int, float, float]] = None

            for axis in self.point_event_axes:
                route_start, route_end, scope = self._derive_route_scope(incident, axis_bearing=float(axis))
                try:
                    plan = self._plan_for_route_scope(incident, route_start, route_end, scope, alternatives=alternatives)
                except MapplsAPIError:
                    continue

                method = plan["diversion"]["method"]
                rank_map = {
                    "alternative_route": 0,
                    "forced_via_detour": 1,
                    "none_required": 2,
                    "forced_via_detour_partial": 3,
                }
                rank = (rank_map.get(method, 99), plan["diversion"]["extra_distance_km"], plan["diversion"]["extra_time_min"])

                # Prefer a clean diversion first; otherwise keep the least-bad one.
                if best_plan is None or rank < best_rank:
                    best_plan = plan
                    best_rank = rank

                if method in ("alternative_route", "forced_via_detour") and not plan["diversion"]["still_intersects_closure"]:
                    return plan

            if best_plan is None:
                raise MapplsAPIError("Unable to build any diversion plan for the point event")
            return best_plan

        route_start, route_end, scope = self._derive_route_scope(incident)
        return self._plan_for_route_scope(incident, route_start, route_end, scope, alternatives=alternatives)


# --------------------------------------------------------------------------- #
# Convenience: thresholds for "should we even bother diverting?"
# --------------------------------------------------------------------------- #

def should_divert(incident: Incident, min_duration_minutes: float = 10.0) -> bool:
    return incident.duration_minutes >= min_duration_minutes


if __name__ == "__main__":
    # Example usage (requires a valid Mappls REST / Map SDK Key).
    ACCESS_TOKEN = "eb08c13b7794440e9236411adc7b31a0"

    incident = Incident(
        latitude=12.99378563,
        longitude=77.58500934,
        end_latitude=None,  # set to a different point for segment events
        end_longitude=None,
        affected_radius_km=0.8,
        duration_minutes=45,
        severity="High",
        corridor="bellary_road_1",
        junction="unknown",
    )

    planner = DiversionPlanner(access_token=ACCESS_TOKEN)

    if should_divert(incident):
        plan = planner.generate_plan(incident)
        with open("diversion_plan.json", "w", encoding="utf-8") as f:
            json.dump(plan, f, indent=2)
        print("Saved to diversion_plan.json")
        print(json.dumps({
            "method": plan["diversion"]["method"],
            "manual_review_required": plan["diversion"]["manual_review_required"],
            "predicted_radius_km": plan["diversion"]["predicted_radius_km"],
            "routing_radius_km": plan["diversion"]["routing_radius_km"],
        }, indent=2))
    else:
        print("Incident too short-lived to warrant a diversion plan.")
