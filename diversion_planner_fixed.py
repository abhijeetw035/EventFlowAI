"""
diversion_planner.py

Turns a predicted traffic-event (severity, affected_radius, duration ...
coming from your teammates' model) into a concrete diversion plan:
  - a diversion path that avoids the incident's impact zone
  - the extra distance/time cost of diverting
  - barricade points (where the closure should be cordoned on the original road)
  - manpower points (where police/signage should redirect traffic)

It calls the Mappls (MapmyIndia) REST Direction API directly:
    https://route.mappls.com/route/direction/{resource}/{profile}/{coords}

No browser / JS SDK involved -- this is meant to sit in your backend,
called once your model emits a prediction for an event.

Dependencies: requests  (pip install requests)
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field, asdict
from typing import List, Tuple, Optional, Dict, Any

import requests

Point = Tuple[float, float]  # (latitude, longitude)

MAPPLS_DIRECTION_BASE = "https://route.mappls.com/route/direction"
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

    lat2 = math.asin(math.sin(lat1) * math.cos(delta) + math.cos(lat1) * math.sin(delta) * math.cos(brng))
    lon2 = lon1 + math.atan2(
        math.sin(brng) * math.sin(delta) * math.cos(lat1),
        math.cos(delta) - math.sin(lat1) * math.sin(lat2),
    )
    return (math.degrees(lat2), (math.degrees(lon2) + 540) % 360 - 180)


def decode_polyline(encoded: str, precision: int = 5) -> List[Point]:
    """
    Decode an OSRM/Google-style encoded polyline into a list of (lat, lon).
    `precision` matches the API's geometry precision (5 -> polyline, 6 -> polyline6).
    """
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


def min_distance_to_point_km(path: List[Point], point: Point) -> float:
    if not path:
        return float("inf")
    return min(haversine_km(c, point) for c in path)


def _clip(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def distance_point_to_segment_km(p: Point, a: Point, b: Point) -> float:
    """
    Shortest distance from point p to the great-circle segment a->b, in km.
    Used when the event spans a segment (e.g. start/end points differ).
    Falls back to endpoint distance if the perpendicular projection lies
    outside the segment.
    """
    if a == b:
        return haversine_km(p, a)

    R = EARTH_RADIUS_KM
    seg_len_km = haversine_km(a, b)
    d_ap_km = haversine_km(a, p)
    if d_ap_km == 0:
        return 0.0

    bearing_ab = math.radians(initial_bearing_deg(a, b))
    bearing_ap = math.radians(initial_bearing_deg(a, p))
    d_ap_ang = d_ap_km / R

    cross_track_ang = math.asin(_clip(math.sin(d_ap_ang) * math.sin(bearing_ap - bearing_ab)))
    cross_track_km = abs(cross_track_ang * R)

    # Along-track distance from a to closest point on the infinite great-circle.
    # If that point is outside the segment, use the nearer endpoint instead.
    ratio = _clip(math.cos(d_ap_ang) / math.cos(cross_track_ang)) if math.cos(cross_track_ang) != 0 else 1.0
    along_track_km = math.acos(ratio) * R

    if 0 <= along_track_km <= seg_len_km:
        return cross_track_km
    return min(d_ap_km, haversine_km(b, p))


# --------------------------------------------------------------------------- #
# Data classes
# --------------------------------------------------------------------------- #

@dataclass
class Incident:
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
        return (self.latitude, self.longitude)

    @property
    def end_point(self) -> Point:
        if self.end_latitude is not None and self.end_longitude is not None:
            return (self.end_latitude, self.end_longitude)
        return self.start_point

    @property
    def is_point_event(self) -> bool:
        return self.end_point == self.start_point

    @property
    def point(self) -> Point:
        # Backward-compatible alias; used as a single anchor when the event is point-like.
        return self.start_point

    @property
    def anchor_point(self) -> Point:
        if self.is_point_event:
            return self.start_point
        lat1, lon1 = self.start_point
        lat2, lon2 = self.end_point
        return ((lat1 + lat2) / 2.0, (lon1 + lon2) / 2.0)

    def distance_to_km(self, p: Point) -> float:
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
    def __init__(self, access_token: str, region: str = "ind", session: Optional[requests.Session] = None):
        self.access_token = access_token
        self.region = region
        self.session = session or requests.Session()

    # -- low level API call -------------------------------------------------

    def _coords_to_query(self, points: List[Point]) -> str:
        # Mappls expects lon,lat (note the order flip from our internal lat,lon)
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
        """
        Hit the Mappls Direction REST API. Returns the full parsed response
        (not just `routes`) because `waypoints` tells you where each input
        point -- including a `via` point -- actually got snapped onto the
        real road network, which matters for debugging forced detours.
        """
        waypoints = [start] + (via or []) + [end]
        coord_str = self._coords_to_query(waypoints)
        url = (
            f"https://apis.mappls.com/advancedmaps/v1/"
            f"{self.access_token}/"
            f"{resource}/"
            f"{profile}/"
            f"{coord_str}"
        )

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

    # -- route scoring against the incident geofence -------------------------

    def _to_candidate(self, raw_route: Dict[str, Any], incident: Incident) -> RouteCandidate:
        geometry = raw_route["geometry"]
        path = decode_polyline(geometry, precision=5)
        min_dist = min(incident.distance_to_km(c) for c in path) if path else float("inf")
        return RouteCandidate(
            distance_km=raw_route.get("distance", 0) / 1000.0,
            duration_min=raw_route.get("duration", 0) / 60.0,
            path=path,
            raw_geometry=geometry,
            min_distance_to_incident_km=min_dist,
            intersects_closure=min_dist <= incident.affected_radius_km,
        )

    @staticmethod
    def _local_corridor_bearing(baseline: RouteCandidate, incident: Incident, start: Point, end: Point) -> float:
        """
        Bearing of the road *right where it passes the incident*, not the
        straight-line bearing of the whole trip. If the incident has a path
        footprint (start/end differ), we use the midpoint anchor.
        """
        path = baseline.path
        if len(path) < 3:
            return initial_bearing_deg(start, end)
        anchor = incident.anchor_point
        closest_idx = min(range(len(path)), key=lambda i: incident.distance_to_km(path[i]))
        i0 = max(closest_idx - 1, 0)
        i1 = min(closest_idx + 1, len(path) - 1)
        if i0 == i1:
            return initial_bearing_deg(start, end)
        return initial_bearing_deg(path[i0], path[i1])

    def _search_via_detour(
        self,
        incident: Incident,
        start: Point,
        end: Point,
        baseline: RouteCandidate,
        resource: str = "route_eta",
        buffer_km: float = 0.5,
        angle_offsets: Tuple[int, ...] = (90, -90, 60, -60, 120, -120, 45, -45),
        distance_multipliers: Tuple[float, ...] = (1.0, 2.0, 3.5, 5.0),
        max_attempts: int = 24,
    ) -> Tuple[Optional[RouteCandidate], Optional[Point], List[Dict[str, Any]]]:
        """
        Try a spread of candidate via points (different angles off the
        *local* road direction, at increasing distances) until one produces
        a route that actually clears the incident's geofence. Returns the
        first one that clears, or -- if none do -- the least-bad attempt,
        plus a log of everything tried for debugging.
        """
        base_bearing = self._local_corridor_bearing(baseline, incident, start, end)
        anchor = incident.anchor_point
        attempts: List[Dict[str, Any]] = []
        best: Optional[RouteCandidate] = None
        best_via: Optional[Point] = None
        calls = 0

        for mult in distance_multipliers:
            distance_km = mult * (incident.affected_radius_km + buffer_km)
            for angle in angle_offsets:
                if calls >= max_attempts:
                    break
                calls += 1
                via_point = destination_point(anchor, (base_bearing + angle) % 360, distance_km)

                try:
                    data = self.fetch_routes(start, end, via=[via_point], resource=resource, alternatives=1)
                except MapplsAPIError:
                    continue

                candidate = self._to_candidate(data["routes"][0], incident)

                snap_distance_km = None
                wps = data.get("waypoints")
                if wps and len(wps) >= 3 and wps[1].get("location"):
                    snap_lon, snap_lat = wps[1]["location"][0], wps[1]["location"][1]
                    snap_distance_km = round(haversine_km(via_point, (snap_lat, snap_lon)), 3)

                via_distance_from_route_km = round(min_distance_to_point_km(candidate.path, via_point), 3)
                via_appears_ignored = via_distance_from_route_km > max(0.3, incident.affected_radius_km * 0.5)

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

        return best, best_via, attempts

    # -- barricade / manpower point derivation --------------------------------

    @staticmethod
    def _closure_boundary_points(path: List[Point], incident: Incident) -> Dict[str, Optional[Point]]:
        """Walk the baseline path and find where it crosses into/out of the incident footprint."""
        inside_idx = [i for i, c in enumerate(path) if incident.distance_to_km(c) <= incident.affected_radius_km]
        if not inside_idx:
            return {"entry": None, "exit": None}
        return {"entry": path[inside_idx[0]], "exit": path[inside_idx[-1]]}

    # -- public entry point ---------------------------------------------------

    def generate_plan(
        self,
        incident: Incident,
        start: Point,
        end: Point,
        alternatives: int = 3,
    ) -> Dict[str, Any]:
        """
        Build a full diversion plan for travel between `start` and `end`
        given a predicted `incident`.
        """
        # 1. Baseline route, as if the incident didn't exist
        baseline_data = self.fetch_routes(start, end, resource="route_eta", alternatives=1)
        baseline = self._to_candidate(baseline_data["routes"][0], incident)

        if not baseline.intersects_closure:
            return self._build_response(incident, baseline, baseline, method="none_required", via_point=None)

        # 2. Ask for alternative routes, keep the ones that clear the geofence
        alt_data = self.fetch_routes(start, end, resource="route_eta", alternatives=alternatives)
        candidates = [self._to_candidate(r, incident) for r in alt_data["routes"]]
        clear = [c for c in candidates if not c.intersects_closure]

        if clear:
            best = min(clear, key=lambda c: c.duration_min)
            return self._build_response(incident, baseline, best, method="alternative_route", via_point=None)

        # 3. No natural alternative clears it -> search for a forced via-point detour
        forced, via_point, attempts = self._search_via_detour(incident, start, end, baseline)
        if forced is None:
            forced, via_point = baseline, None  # API calls all failed; fall back rather than crash

        method = "forced_via_detour" if not forced.intersects_closure else "forced_via_detour_partial"
        return self._build_response(incident, baseline, forced, method=method, via_point=via_point, search_attempts=attempts)

    def _build_response(
        self,
        incident: Incident,
        baseline: RouteCandidate,
        chosen: RouteCandidate,
        method: str,
        via_point: Optional[Point],
        search_attempts: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        boundary = self._closure_boundary_points(baseline.path, incident)
        barricade_points = [
            {"label": "closure_entry", "lat": boundary["entry"][0], "lon": boundary["entry"][1]}
            if boundary["entry"] else None,
            {"label": "closure_exit", "lat": boundary["exit"][0], "lon": boundary["exit"][1]}
            if boundary["exit"] else None,
        ]
        barricade_points = [b for b in barricade_points if b]

        manpower_points = list(barricade_points)
        if via_point:
            manpower_points.append({"label": "diversion_redirect_point", "lat": via_point[0], "lon": via_point[1]})

        diversion: Dict[str, Any] = {
            "method": method,  # none_required | alternative_route | forced_via_detour | forced_via_detour_partial
            "manual_review_required": method == "forced_via_detour_partial",
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

        plan = {
            "incident": asdict(incident),
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
        return plan


# --------------------------------------------------------------------------- #
# Convenience: thresholds for "should we even bother diverting?"
# Tune these against your team's model output distribution.
# --------------------------------------------------------------------------- #

def should_divert(incident: Incident, min_duration_minutes: float = 10.0) -> bool:
    """Simple gate: don't bother generating/announcing a diversion for very
    short-lived events (e.g. a 3-minute breakdown clears before signage helps)."""
    return incident.duration_minutes >= min_duration_minutes


if __name__ == "__main__":
    # Example usage (requires network + a valid access_token to actually run).
    ACCESS_TOKEN = "eb08c13b7794440e9236411adc7b31a0"

    incident = Incident(
        latitude=12.9716,
        longitude=77.5946,
        affected_radius_km=0.8,
        duration_minutes=45,
        severity="high",
        corridor="hosur_road",
        junction="silkboardjunc",
    )

    start = (12.9550, 77.6200)  # e.g. a junction before the incident
    end = (12.9900, 77.5700)    # e.g. a junction after the incident

    planner = DiversionPlanner(access_token=ACCESS_TOKEN)

    if should_divert(incident):
        plan = planner.generate_plan(incident, start, end)  
        with open("diversion_plan.json", "w") as f:
            json.dump(plan, f, indent=2)
        print("Saved to diversion_plan.json")
        print(json.dumps(plan, indent=2))
    else:
        print("Incident too short-lived to warrant a diversion plan.")