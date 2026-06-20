import { useEffect, useMemo, useState } from "react";
import { calculateClusterDiversion, calculateRouteDiversion, getDataset, predictDeployment } from "./api/client.js";
import DiversionResultsPanel from "./components/DiversionResultsPanel.jsx";
import IncidentForm from "./components/IncidentForm.jsx";
import MapView from "./components/MapView.jsx";
import RadiusSlider from "./components/RadiusSlider.jsx";
import RoutePlannerPanel from "./components/RoutePlannerPanel.jsx";
import TimelineScrubber from "./components/TimelineScrubber.jsx";

const defaultForm = {
  lat: "",
  lon: "",
  event_type: "unplanned",
  event_cause: "unknown",
  priority: "unknown",
  veh_type: "unknown",
  requires_road_closure: false,
  corridor: "unknown",
  junction: "unknown",
  zone: "unknown",
  description: "",
};

function explicitEventEndTime(incident) {
  const endStr =
    incident.end_datetime ||
    incident.resolved_datetime ||
    incident.closed_datetime ||
    ((incident.status === "closed" || incident.status === "resolved") ? incident.modified_datetime : "");
  if (!endStr) return NaN;
  const parsed = new Date(endStr).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeDataset(data) {
  let minTime = Infinity;
  let maxTime = -Infinity;

  const incidents = data
    .map((incident) => {
      if (!incident.start_datetime) return null;
      const parsedStart = new Date(incident.start_datetime).getTime();
      if (Number.isNaN(parsedStart)) return null;
      const explicitEnd = explicitEventEndTime(incident);
      minTime = Math.min(minTime, parsedStart);
      maxTime = Math.max(maxTime, parsedStart, Number.isFinite(explicitEnd) ? explicitEnd : -Infinity);
      return { ...incident, parsedStart, explicitEnd };
    })
    .filter(Boolean);

  const stableHorizon = Number.isFinite(maxTime) ? maxTime : minTime;
  return {
    incidents: incidents.map((incident, index) => ({
      ...incident,
      parsedEnd: Number.isFinite(incident.explicitEnd) ? incident.explicitEnd : stableHorizon,
      stableKey: `${String(incident.id || incident.event_id || "incident")}-${index}`,
    })),
    minTime,
    maxTime: stableHorizon,
  };
}

function getDistance(lat1, lon1, lat2, lon2) {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Pads a bounding box around A and B so incidents just off the direct line are still caught. */
function getPaddedBoundingBox(a, b, paddingRatio = 0.3, minPaddingKm = 0.5) {
  const minLat = Math.min(a.lat, b.lat);
  const maxLat = Math.max(a.lat, b.lat);
  const minLon = Math.min(a.lon, b.lon);
  const maxLon = Math.max(a.lon, b.lon);

  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;

  const avgLat = (minLat + maxLat) / 2;
  const kmPerDegLat = 111.0;
  const kmPerDegLon = 111.0 * Math.cos((avgLat * Math.PI) / 180);

  const latPadding = Math.max(latSpan * paddingRatio, minPaddingKm / kmPerDegLat);
  const lonPadding = Math.max(lonSpan * paddingRatio, minPaddingKm / kmPerDegLon);

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLon: minLon - lonPadding,
    maxLon: maxLon + lonPadding,
  };
}

function readString(incident, keys, fallback = "unknown") {
  for (const key of keys) {
    const value = incident[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return fallback;
}

function readBool(incident, keys) {
  for (const key of keys) {
    const value = incident[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string" && value.trim() !== "") {
      return ["true", "yes", "1", "y", "closed", "closure"].includes(value.trim().toLowerCase());
    }
  }
  return false;
}

function deploymentPayloadFromIncident(incident) {
  const lat = Number(incident.latitude ?? incident.lat);
  const lon = Number(incident.longitude ?? incident.lon);
  const eventCause = readString(incident, ["event_cause", "cause", "eventcause"], "unknown");
  const description = readString(incident, ["description", "event_description", "details", "remarks"], eventCause);

  return {
    lat,
    lon,
    event_type: readString(incident, ["event_type", "type"], "unplanned").toLowerCase().includes("planned")
      ? "planned"
      : "unplanned",
    event_cause: eventCause,
    priority: readString(incident, ["priority", "event_priority", "severity"], "unknown").toLowerCase(),
    veh_type: readString(incident, ["veh_type", "vehicle_type", "vehicle", "involved_vehicle"], "unknown"),
    requires_road_closure: readBool(incident, ["requires_road_closure", "road_closure", "is_road_closed", "road_closed"]),
    corridor: readString(incident, ["corridor", "road_name", "road", "street"], "unknown"),
    junction: readString(incident, ["junction", "junction_name", "intersection"], "unknown"),
    zone: readString(incident, ["zone", "police_zone", "area"], "unknown"),
    description,
    start_datetime: readString(incident, ["start_datetime"], "") || null,
    expected_duration_minutes: 60,
  };
}

function normalizeDiversionResult(result) {
  const diversions = Array.isArray(result?.diversions)
    ? result.diversions.map((diversion) => {
        const coordinates = Array.isArray(diversion.coordinates)
          ? diversion.coordinates
              .map((point) => [Number(point?.[0]), Number(point?.[1])])
              .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))
          : [];

        return {
          ...diversion,
          coordinates,
          status: diversion.status === "success" && coordinates.length >= 2 ? "success" : diversion.status || "gridlock",
        };
      })
    : [];

  return {
    ...result,
    diversions,
    total_diversions: diversions.filter((diversion) => diversion.status === "success").length,
  };
}

export default function App() {
  const [allIncidents, setAllIncidents] = useState([]);
  const [minTime, setMinTime] = useState(NaN);
  const [maxTime, setMaxTime] = useState(NaN);
  const [selectedTime, setSelectedTime] = useState(NaN);
  const [radiusKm, setRadiusKm] = useState(1.5);
  const [status, setStatus] = useState("Loading dataset...");
  const [error, setError] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [clusterCount, setClusterCount] = useState(0);
  const [diversionResult, setDiversionResult] = useState(null);
  const [deploymentResult, setDeploymentResult] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [temporaryIncident, setTemporaryIncident] = useState(null);
  const [submittingForm, setSubmittingForm] = useState(false);

  // --- Point-to-Point Route Planner State ---
  const [routeMode, setRouteMode] = useState(false);
  const [routeStart, setRouteStart] = useState(null);
  const [routeEnd, setRouteEnd] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [routeCalculating, setRouteCalculating] = useState(false);
  const [routeStatus, setRouteStatus] = useState(
    'Click "Plan New Diversion Route", then click Point A and Point B on the map.'
  );

  useEffect(() => {
    getDataset()
      .then((result) => {
        if (result.status !== "success") throw new Error(result.message || "Dataset load failed.");
        const normalized = normalizeDataset(result.data);
        setAllIncidents(normalized.incidents);
        setMinTime(normalized.minTime);
        setMaxTime(normalized.maxTime);
        setSelectedTime(normalized.maxTime);
        setStatus(`Successfully loaded ${normalized.incidents.length} temporal incidents.`);
      })
      .catch((err) => {
        setError(`Backend offline or dataset unavailable. ${err.message}`);
        setStatus("");
      });
  }, []);

  const activeIncidents = useMemo(() => {
    if (!Number.isFinite(selectedTime)) return [];
    return allIncidents.filter((incident) => selectedTime >= incident.parsedStart && selectedTime <= incident.parsedEnd);
  }, [allIncidents, selectedTime]);

  function localClusterFor(lat, lon) {
    return activeIncidents.filter((incident) => {
      const incLat = Number(incident.latitude);
      const incLon = Number(incident.longitude);
      if (!Number.isFinite(incLat) || !Number.isFinite(incLon)) return false;
      return getDistance(lat, lon, incLat, incLon) <= radiusKm;
    });
  }

  function getBlockingIncidents(a, b) {
    const bbox = getPaddedBoundingBox(a, b);
    return activeIncidents.filter((inc) => {
      const lat = Number(inc.latitude);
      const lon = Number(inc.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
      return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
    });
  }

  async function runDiversion(incident, clusterOverride) {
    const lat = Number(incident.latitude ?? incident.lat);
    const lon = Number(incident.longitude ?? incident.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Incident requires valid coordinates.");

    const cluster = clusterOverride ?? localClusterFor(lat, lon);
    const clusterPayload = cluster.map((item) => ({
      lat: Number(item.latitude ?? item.lat),
      lon: Number(item.longitude ?? item.lon),
    }));

    setSelectedTarget({ lat, lon });
    setClusterCount(clusterPayload.length);
    setStatus(`Scanning nearby incidents and computing local macro-flanks for ${incident.id || "manual incident"}...`);
    const response = await calculateClusterDiversion({
      target: { lat, lon },
      active_cluster: clusterPayload,
    });
    const result = normalizeDiversionResult(response);
    setDiversionResult(result);
    setStatus("");
    return result;
  }

  async function runDeployment(incident) {
    setStatus(`Requesting deployment recommendation for ${incident.id || "manual incident"}...`);
    const result = await predictDeployment(deploymentPayloadFromIncident(incident));
    setDeploymentResult(result);
    setStatus("");
    return result;
  }

  async function handleCalculateDiversion(incident) {
    setError("");
    setSelectedName(incident.id || "Manual Incident");
    setDeploymentResult(null);
    clearRoute();
    try {
      await runDiversion(incident);
    } catch (err) {
      setError(`Engine error: ${err.message}`);
      setStatus("");
    }
  }

  async function handleRecommendDeployment(incident) {
    setError("");
    setSelectedName(incident.id || "Manual Incident");
    try {
      await runDeployment(incident);
    } catch (err) {
      setError(`Deployment recommendation failed: ${err.message}`);
      setStatus("");
    }
  }

  function handleMapClick(point) {
    setForm((current) => ({ ...current, lat: point.lat.toFixed(6), lon: point.lon.toFixed(6) }));
  }

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmittingForm(true);

    const manualIncident = {
      ...form,
      id: "Manual Incident",
      latitude: Number(form.lat),
      longitude: Number(form.lon),
      start_datetime: new Date().toISOString(),
    };

    if (!Number.isFinite(manualIncident.latitude) || !Number.isFinite(manualIncident.longitude)) {
      setError("Manual incident requires valid latitude and longitude.");
      setSubmittingForm(false);
      return;
    }

    setTemporaryIncident(manualIncident);
    setSelectedName("Manual Incident");
    try {
      await Promise.all([runDiversion(manualIncident, localClusterFor(manualIncident.latitude, manualIncident.longitude)), runDeployment(manualIncident)]);
    } catch (err) {
      setError(`Manual incident failed: ${err.message}`);
      setStatus("");
    } finally {
      setSubmittingForm(false);
    }
  }

  function toggleRouteMode() {
    clearRoute();
    setRouteMode(true);
    setRouteStatus("Click Point A (origin) on the map.");
  }

  function clearRoute() {
    setRouteMode(false);
    setRouteStart(null);
    setRouteEnd(null);
    setRouteResult(null);
    setRouteCalculating(false);
    setRouteStatus('Click "Plan New Diversion Route", then click Point A and Point B on the map.');
  }

  async function handleRoutePlanClick(latlng) {
    if (!routeMode) return;

    if (!routeStart) {
      setRouteStart({ lat: latlng.lat, lon: latlng.lng });
      setRouteStatus("Point A set. Now click Point B (destination) on the map.");
    } else if (!routeEnd) {
      const end = { lat: latlng.lat, lon: latlng.lng };
      setRouteEnd(end);
      setRouteMode(false);

      setRouteCalculating(true);
      setRouteStatus("Calculating diversion route, avoiding nearby active incidents...");

      const blocking = getBlockingIncidents(routeStart, end);
      const blockingPayload = blocking.map((inc) => ({
        lat: Number(inc.latitude),
        lon: Number(inc.longitude),
      }));

      try {
        const data = await calculateRouteDiversion({
          start: routeStart,
          end,
          blocking_incidents: blockingPayload,
        });
        setRouteResult({ ...data, blockingCount: blockingPayload.length });

        if (data.status === "success") {
          setRouteStatus(`Route calculated — avoided ${blockingPayload.length} active incident(s).`);
        } else if (data.status === "gridlock") {
          setRouteStatus(`No diversion possible — gridlock with ${blockingPayload.length} active incident(s).`);
        } else {
          setRouteStatus(`Engine error: ${data.message || "Unknown error."}`);
        }
      } catch (err) {
        setRouteResult({ status: "error", message: err.message });
        setRouteStatus(`Engine error: ${err.message}`);
      } finally {
        setRouteCalculating(false);
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      {/* ─── HEADER ─── */}
      <header className="glass-organic sticky top-0 z-20 flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-4">
          {/* Organic logo mark */}
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary shadow-ambient-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-on-surface">
              EventFlow <span className="text-primary">AI</span>
            </h1>
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.15em] text-on-surface-var">
              Operations Console
            </p>
          </div>
        </div>
        {/* Live count chip */}
        <div className="flex items-center gap-2.5 rounded-full bg-surface-container-lowest px-4 py-2 shadow-ambient-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
          </span>
          <span className="font-display text-sm font-bold text-on-surface">
            {activeIncidents.length}
          </span>
          <span className="text-xs text-on-surface-var">live</span>
        </div>
      </header>

      {/* ─── MAIN 3-COLUMN CONTENT ─── */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* ─── LEFT SIDEBAR ─── */}
        <aside className="w-full bg-surface-container-low lg:w-[400px] shrink-0">
          <div className="h-full overflow-y-auto custom-scrollbar px-6 py-6 space-y-6">
            <TimelineScrubber
              minTime={minTime}
              maxTime={maxTime}
              value={selectedTime}
              disabled={!allIncidents.length}
              onChange={(value) => {
                setSelectedTime(value);
                setDiversionResult(null);
                setSelectedTarget(null);
                clearRoute();
              }}
            />
            <RadiusSlider value={radiusKm} onChange={setRadiusKm} />
            <RoutePlannerPanel
              routeMode={routeMode}
              routeStart={routeStart}
              routeEnd={routeEnd}
              routeStatus={routeStatus}
              calculating={routeCalculating}
              onToggle={toggleRouteMode}
              onClear={clearRoute}
            />
            <IncidentForm
              open={formOpen}
              onToggle={() => setFormOpen((value) => !value)}
              form={form}
              onChange={handleFormChange}
              onSubmit={handleFormSubmit}
              mapPoint={form.lat && form.lon ? { lat: Number(form.lat), lon: Number(form.lon) } : null}
              submitting={submittingForm}
            />
          </div>
        </aside>

        {/* ─── CENTER MAP ─── */}
        <main className="relative flex-1 min-h-[520px] lg:min-h-0">
          <MapView
            incidents={activeIncidents}
            temporaryIncident={temporaryIncident}
            selectedTarget={selectedTarget}
            radiusKm={radiusKm}
            diversionResult={diversionResult}
            formOpen={formOpen}
            onMapClick={handleMapClick}
            onCalculateDiversion={handleCalculateDiversion}
            onRecommendDeployment={handleRecommendDeployment}
            routeMode={routeMode}
            routeStart={routeStart}
            routeEnd={routeEnd}
            routeResult={routeResult}
            onRoutePlanClick={handleRoutePlanClick}
          />
          <div className="map-edge-fade" />
        </main>

        {/* ─── RIGHT TELEMETRY PANEL ─── */}
        <DiversionResultsPanel
          status={status}
          selectedName={selectedName}
          clusterCount={clusterCount}
          diversionResult={diversionResult}
          deploymentResult={deploymentResult}
          routeResult={routeResult}
          error={error}
        />
      </div>
    </div>
  );
}
