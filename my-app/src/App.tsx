import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Circle, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, MapPinned, Route, ShieldAlert, ShieldCheck } from "lucide-react";

// Fix default Leaflet marker icons in bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(delete (L.Icon.Default.prototype as any)._getIconUrl);
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Point = { lat: number; lon: number };

type Incident = {
  latitude: number;
  longitude: number;
  end_latitude?: number | null;
  end_longitude?: number | null;
  affected_radius_km: number;
  duration_minutes: number;
  severity?: string;
  corridor?: string;
  junction?: string;
};

type Diversion = {
  method: string;
  manual_review_required?: boolean;
  predicted_radius_km?: number;
  routing_radius_km?: number;
  distance_km?: number;
  duration_min?: number;
  extra_distance_km?: number;
  extra_time_min?: number;
  still_intersects_closure?: boolean;
  via_point?: Point | null;
  path: Point[];
};

type Plan = {
  incident: Incident;
  routing_scope?: {
    mode?: string;
    axis_bearing?: number;
    scope_buffer_km?: number;
    route_start?: Point;
    route_end?: Point;
  };
  baseline_route?: {
    distance_km?: number;
    duration_min?: number;
    min_distance_to_incident_km?: number;
    intersects_closure?: boolean;
  };
  diversion: Diversion;
  barricade_points?: Array<{ label: string; lat: number; lon: number }>;
  manpower_points?: Array<{ label: string; lat: number; lon: number }>;
};

type BoundsSetterProps = { points: [number, number][] };

function BoundsSetter({ points }: BoundsSetterProps) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.2));
  }, [map, points]);

  return null;
}

function methodLabel(method: string) {
  switch (method) {
    case "alternative_route":
      return "Alternative route";
    case "forced_via_detour":
      return "Diversion found";
    case "forced_via_detour_partial":
      return "Manual review needed";
    case "none_required":
      return "No diversion needed";
    default:
      return method;
  }
}

function methodColor(method: string) {
  switch (method) {
    case "alternative_route":
    case "forced_via_detour":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "forced_via_detour_partial":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "none_required":
      return "bg-sky-100 text-sky-800 border-sky-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

const samplePlan: Plan = {
  incident: {
    latitude: 12.99378563,
    longitude: 77.58500934,
    end_latitude: 12.9865118,
    end_longitude: 77.57968247,
    affected_radius_km: 1.949,
    duration_minutes: 10080,
    severity: "High",
    corridor: "bellary_road_1",
    junction: "unknown",
  },
  routing_scope: {
    mode: "segment_bypass",
    axis_bearing: 215.5,
    scope_buffer_km: 0.75,
    route_start: { lat: 12.999275919071183, lon: 77.5890303223913 },
    route_end: { lat: 12.981021449124981, lon: 77.57566178312811 },
  },
  baseline_route: {
    distance_km: 3.9,
    duration_min: 11.9,
    min_distance_to_incident_km: 0.431,
    intersects_closure: true,
  },
  diversion: {
    method: "forced_via_detour_partial",
    manual_review_required: true,
    predicted_radius_km: 1.949,
    routing_radius_km: 0.585,
    distance_km: 8.44,
    duration_min: 25.5,
    extra_distance_km: 4.54,
    extra_time_min: 13.6,
    still_intersects_closure: true,
    via_point: { lat: 13.003208007482755, lon: 77.5932357890182 },
    path: [],
  },
  barricade_points: [
    { label: "closure_entry", lat: 12.99627, lon: 77.58972 },
    { label: "closure_exit", lat: 12.98438, lon: 77.57478 },
  ],
  manpower_points: [
    { label: "closure_entry", lat: 12.99627, lon: 77.58972 },
    { label: "closure_exit", lat: 12.98438, lon: 77.57478 },
    { label: "diversion_redirect_point", lat: 13.003208007482755, lon: 77.5932357890182 },
  ],
};

export default function DiversionPlannerMap() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Option A: fetch a JSON file served from public/diversion_plan.json
        // Option B: fall back to embedded sample if the fetch fails.
        const res = await fetch("/diversion_plan.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Plan;
        if (active) setPlan(data);
      } catch {
        if (active) {
          setPlan(samplePlan);
          setError("Loaded sample plan because /diversion_plan.json was not found.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const allPoints = useMemo(() => {
    if (!plan) return [] as [number, number][];
    const pts: [number, number][] = [];

    pts.push([plan.incident.latitude, plan.incident.longitude]);
    if (plan.incident.end_latitude != null && plan.incident.end_longitude != null) {
      pts.push([plan.incident.end_latitude, plan.incident.end_longitude]);
    }

    if (plan.routing_scope?.route_start) {
      pts.push([plan.routing_scope.route_start.lat, plan.routing_scope.route_start.lon]);
    }
    if (plan.routing_scope?.route_end) {
      pts.push([plan.routing_scope.route_end.lat, plan.routing_scope.route_end.lon]);
    }

    plan.diversion.path.forEach((p) => pts.push([p.lat, p.lon]));
    plan.barricade_points?.forEach((p) => pts.push([p.lat, p.lon]));
    plan.manpower_points?.forEach((p) => pts.push([p.lat, p.lon]));
    if (plan.diversion.via_point) pts.push([plan.diversion.via_point.lat, plan.diversion.via_point.lon]);

    return pts;
  }, [plan]);

  if (loading || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <div className="text-lg font-semibold">Loading diversion map…</div>
          <div className="text-sm text-slate-400">Fetching plan JSON and preparing the route view.</div>
        </div>
      </div>
    );
  }

  const eventIsPoint =
    plan.incident.end_latitude == null ||
    plan.incident.end_longitude == null ||
    (plan.incident.latitude === plan.incident.end_latitude &&
      plan.incident.longitude === plan.incident.end_longitude);

  const eventStart: [number, number] = [plan.incident.latitude, plan.incident.longitude];
  const eventEnd: [number, number] = eventIsPoint
    ? [plan.incident.latitude, plan.incident.longitude]
    : [plan.incident.end_latitude!, plan.incident.end_longitude!];

  const diversionPath: [number, number][] = plan.diversion.path.map((p) => [p.lat, p.lon]);
  const barricades = plan.barricade_points ?? [];
  const manpower = plan.manpower_points ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-900/80 border-slate-800 text-white shadow-2xl rounded-3xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl flex items-center gap-2">
              <MapPinned className="h-6 w-6" />
              Diversion Planner
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge className={methodColor(plan.diversion.method)}>
                {methodLabel(plan.diversion.method)}
              </Badge>
              {plan.diversion.manual_review_required ? (
                <Badge variant="outline" className="border-amber-400/40 text-amber-300">
                  <AlertCircle className="mr-1 h-3.5 w-3.5" />
                  Manual review
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  Auto-safe
                </Badge>
              )}
            </div>
            {error ? (
              <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2">
                {error}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-800/80 p-3">
                <div className="text-slate-400 text-xs">Severity</div>
                <div className="mt-1 font-semibold">{plan.incident.severity ?? "—"}</div>
              </div>
              <div className="rounded-2xl bg-slate-800/80 p-3">
                <div className="text-slate-400 text-xs">Duration</div>
                <div className="mt-1 font-semibold">{Math.round(plan.incident.duration_minutes)} min</div>
              </div>
              <div className="rounded-2xl bg-slate-800/80 p-3">
                <div className="text-slate-400 text-xs">Predicted radius</div>
                <div className="mt-1 font-semibold">{plan.diversion.predicted_radius_km?.toFixed(3)} km</div>
              </div>
              <div className="rounded-2xl bg-slate-800/80 p-3">
                <div className="text-slate-400 text-xs">Routing radius</div>
                <div className="mt-1 font-semibold">{plan.diversion.routing_radius_km?.toFixed(3)} km</div>
              </div>
              <div className="rounded-2xl bg-slate-800/80 p-3">
                <div className="text-slate-400 text-xs">Diversion distance</div>
                <div className="mt-1 font-semibold">{plan.diversion.distance_km?.toFixed(2)} km</div>
              </div>
              <div className="rounded-2xl bg-slate-800/80 p-3">
                <div className="text-slate-400 text-xs">Extra time</div>
                <div className="mt-1 font-semibold">{plan.diversion.extra_time_min?.toFixed(1)} min</div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-800/80 p-3 space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Route className="h-4 w-4" /> Route details
              </div>
              <div className="text-slate-300">
                {plan.routing_scope?.mode === "segment_bypass"
                  ? "Blocked road segment with bypass around the event corridor."
                  : "Point event with local bypass around the incident location."}
              </div>
              <div className="text-slate-400 text-xs">
                Baseline route: {plan.baseline_route?.distance_km?.toFixed(2)} km • {plan.baseline_route?.duration_min?.toFixed(1)} min
              </div>
              <div className="text-slate-400 text-xs">
                Still intersects closure: {String(plan.diversion.still_intersects_closure)}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-800/80 p-3 space-y-2">
              <div className="font-medium flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Barricade points
              </div>
              {barricades.length ? (
                barricades.map((p) => (
                  <div key={p.label} className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-700 py-1 last:border-b-0">
                    <span>{p.label}</span>
                    <span>
                      {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">No barricade points found.</div>
              )}
            </div>

            <div className="rounded-2xl bg-slate-800/80 p-3 space-y-2">
              <div className="font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Manpower points
              </div>
              {manpower.length ? (
                manpower.map((p) => (
                  <div key={`${p.label}-${p.lat}-${p.lon}`} className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-700 py-1 last:border-b-0">
                    <span>{p.label}</span>
                    <span>
                      {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">No manpower points found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 text-white shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-xl">Map view</CardTitle>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="border-red-400/40 text-red-300">Blocked road</Badge>
                <Badge variant="outline" className="border-yellow-400/40 text-yellow-300">Diversion path</Badge>
                <Badge variant="outline" className="border-blue-400/40 text-blue-300">Event</Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="bg-slate-800 hover:bg-slate-700 text-white"
                >
                  Reload
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[700px]">
            <div style={{ height: "700px", width: "100%" }}>
            <div className="bg-red-500 text-white p-2">
              MAP SHOULD BE BELOW THIS
            </div>
              <MapContainer
                center={eventStart}
                zoom={14}
                style={{
                  height: "700px",
                  width: "100%"
                }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <BoundsSetter points={allPoints.length ? allPoints : [eventStart, eventEnd]} />

                {/* Blocked event geometry */}
                {eventIsPoint ? (
                  <Circle
                    center={eventStart}
                    radius={(plan.diversion.routing_radius_km ?? 0.5) * 1000}
                    pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.18, weight: 3 }}
                  >
                    <Popup>
                      Point event zone
                    </Popup>
                  </Circle>
                ) : (
                  <>
                    <Polyline positions={[eventStart, eventEnd]} pathOptions={{ color: "#ef4444", weight: 7, opacity: 0.95 }} />
                    <Polyline positions={[eventStart, eventEnd]} pathOptions={{ color: "#fb7185", weight: 2, dashArray: "10 8", opacity: 0.85 }} />
                    <Marker position={eventStart}>
                      <Popup>Event start</Popup>
                    </Marker>
                    <Marker position={eventEnd}>
                      <Popup>Event end</Popup>
                    </Marker>
                  </>
                )}

                {/* Route scope endpoints */}
                {plan.routing_scope?.route_start ? (
                  <Marker position={[plan.routing_scope.route_start.lat, plan.routing_scope.route_start.lon]}>
                    <Popup>Route start (upstream)</Popup>
                  </Marker>
                ) : null}
                {plan.routing_scope?.route_end ? (
                  <Marker position={[plan.routing_scope.route_end.lat, plan.routing_scope.route_end.lon]}>
                    <Popup>Route end (downstream)</Popup>
                  </Marker>
                ) : null}

                {/* Diversion path */}
                {diversionPath.length > 1 ? (
                  <Polyline positions={diversionPath} pathOptions={{ color: "#facc15", weight: 7, opacity: 0.95 }} />
                ) : null}

                {/* Via point */}
                {plan.diversion.via_point ? (
                  <Marker position={[plan.diversion.via_point.lat, plan.diversion.via_point.lon]}>
                    <Popup>Detour via point</Popup>
                  </Marker>
                ) : null}

                {/* Barricades */}
                {barricades.map((p) => (
                  <Marker key={p.label} position={[p.lat, p.lon]}>
                    <Popup>
                      🚧 {p.label}
                    </Popup>
                  </Marker>
                ))}

                {/* Manpower */}
                {manpower.map((p) => (
                  <Marker key={`${p.label}-${p.lat}-${p.lon}`} position={[p.lat, p.lon]}>
                    <Popup>
                      👮 {p.label}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
