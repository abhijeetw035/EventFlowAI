import { useEffect, useMemo, useState } from "react";
import { calculateClusterDiversion, calculateRouteDiversion, getDataset, predictDeployment, predictDeploymentCluster, findSimilarIncidents, planEvent, optimizePatrolRoute } from "./api/client.js";
import DiversionResultsPanel from "./components/DiversionResultsPanel.jsx";
import IncidentForm from "./components/IncidentForm.jsx";
import PlanEventForm from "./components/PlanEventForm.jsx";
import MapView from "./components/MapView.jsx";
import RadiusSlider from "./components/RadiusSlider.jsx";
import RoutePlannerPanel from "./components/RoutePlannerPanel.jsx";
import TimelineScrubber from "./components/TimelineScrubber.jsx";
import AnalyticsPanel from "./components/AnalyticsPanel.jsx";
import AuditDashboard from "./components/AuditDashboard.jsx";

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

const defaultPlanEventForm = {
  lat: "",
  lon: "",
  event_type: "festival",
  expected_duration_hours: "",
  planned_date_time: "",
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

  const stableHorizon = Number.isFinite(maxTime) ? Math.min(maxTime, Date.now()) : Date.now();
  return {
    incidents: incidents.map((incident, index) => ({
      ...incident,
      parsedEnd: Number.isFinite(incident.explicitEnd) ? Math.min(incident.explicitEnd, Date.now()) : stableHorizon,
      stableKey: `${String(incident.id || incident.event_id || "incident")}-${index}`,
    })).filter(incident => incident.parsedStart <= Date.now()),
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
    incident_id: String(incident.id || incident.stableKey || "unknown"),
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
  const [similarEventsResult, setSimilarEventsResult] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [temporaryIncident, setTemporaryIncident] = useState(null);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [selectedPathIndex, setSelectedPathIndex] = useState(null);
  
  // Planned event state
  const [planEventOpen, setPlanEventOpen] = useState(false);
  const [planEventForm, setPlanEventForm] = useState(defaultPlanEventForm);
  const [plannedEventResult, setPlannedEventResult] = useState(null);
  const [plannedEventTarget, setPlannedEventTarget] = useState(null);
  const [submittingPlanEvent, setSubmittingPlanEvent] = useState(false);

  // --- Point-to-Point Route Planner State ---
  const [routeMode, setRouteMode] = useState(false);
  const [routeStart, setRouteStart] = useState(null);
  const [routeEnd, setRouteEnd] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [routeCalculating, setRouteCalculating] = useState(false);
  const [routeStatus, setRouteStatus] = useState(
    'Click "Plan New Diversion Route", then click Point A and Point B on the map.'
  );
  
  // --- Patrol Route Optimizer State ---
  const [patrolRouteResult, setPatrolRouteResult] = useState(null);
  const [isGeneratingPatrol, setIsGeneratingPatrol] = useState(false);

  const [currentView, setCurrentView] = useState("map");

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
    setSelectedPathIndex(null);
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
    const lat = Number(incident.latitude ?? incident.lat);
    const lon = Number(incident.longitude ?? incident.lon);
    
    const clusterIncidents = localClusterFor(lat, lon);
    const targetPayload = deploymentPayloadFromIncident(incident);
    const clusterPayloads = clusterIncidents.map(deploymentPayloadFromIncident);

    const result = await predictDeploymentCluster({
      target: targetPayload,
      active_cluster: clusterPayloads.length > 0 ? clusterPayloads : [targetPayload],
      radius_km: radiusKm,
    });

    setDeploymentResult(result);
    setSelectedTarget({ lat, lon });
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

  async function handleFindSimilarEvents(incident) {
    setError("");
    setSelectedName(incident.id || "Manual Incident");
    setStatus(`Finding similar past events for ${incident.id || "manual incident"}...`);
    setSimilarEventsResult(null);
    try {
      const payload = deploymentPayloadFromIncident(incident);
      const result = await findSimilarIncidents({
        description: payload.description,
        event_cause: payload.event_cause,
        event_type: payload.event_type,
        lat: payload.lat,
        lon: payload.lon
      });
      setSimilarEventsResult(result);
      setStatus("");
    } catch (err) {
      setError(`Failed to find similar events: ${err.message}`);
      setStatus("");
    }
  }

  function handleMapClick(point) {
    setForm((current) => ({ ...current, lat: point.lat.toFixed(6), lon: point.lon.toFixed(6) }));
    setPlanEventForm((current) => ({ ...current, lat: point.lat.toFixed(6), lon: point.lon.toFixed(6) }));
  }

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function handlePlanEventFormChange(event) {
    const { name, value } = event.target;
    setPlanEventForm((current) => ({ ...current, [name]: value }));
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
      setForm(defaultForm);
    } catch (err) {
      setError(`Manual incident failed: ${err.message}`);
      setStatus("");
    } finally {
      setSubmittingForm(false);
    }
  }

  async function handlePlanEventSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmittingPlanEvent(true);
    setPlannedEventResult(null);
    setPlannedEventTarget(null);

    const lat = Number(planEventForm.lat);
    const lon = Number(planEventForm.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setError("Planned event requires valid latitude and longitude.");
      setSubmittingPlanEvent(false);
      return;
    }
    
    setSelectedName("Planned Event");
    setStatus("Calculating risk index and deployment lead time...");

    try {
      const result = await planEvent({
        ...planEventForm,
        lat,
        lon,
        expected_duration_hours: Number(planEventForm.expected_duration_hours) || 4.0,
      });
      setPlannedEventResult(result);
      setPlannedEventTarget({ lat, lon });
      setPlanEventForm(defaultPlanEventForm);
      setStatus("");
    } catch (err) {
      setError(`Planned event analysis failed: ${err.message}`);
      setStatus("");
    } finally {
      setSubmittingPlanEvent(false);
    }
  }

  async function handleGeneratePatrolRoute() {
    if (!selectedTarget || !activeIncidents.length) return;
    setIsGeneratingPatrol(true);
    setPatrolRouteResult(null);
    
    const startLat = Number(selectedTarget.latitude || selectedTarget.lat);
    const startLon = Number(selectedTarget.longitude || selectedTarget.lon);
    
    // Use the shared helper to ONLY route within the selected search radius!
    const clusterIncidents = localClusterFor(startLat, startLon);
    
    if (clusterIncidents.length <= 1) {
      setIsGeneratingPatrol(false);
      return;
    }

    // Convert to PatrolPoints
    const activeCluster = clusterIncidents.map(i => ({
      incident_id: i.id || i.incident_id || "unknown",
      lat: Number(i.latitude || i.lat),
      lon: Number(i.longitude || i.lon)
    }));
    
    const startPoint = {
      incident_id: selectedTarget.id || selectedTarget.incident_id || "unknown",
      lat: startLat,
      lon: startLon
    };

    try {
      const res = await optimizePatrolRoute({ start_point: startPoint, active_cluster: activeCluster });
      if (res.status === "error") {
        setError(`Patrol generation failed: ${res.message}`);
      } else {
        setPatrolRouteResult(res);
      }
    } catch (err) {
      setError(`Patrol generation failed: ${err.message}`);
    } finally {
      setIsGeneratingPatrol(false);
    }
  }

  function handleClearAll() {
    setDeploymentResult(null);
    setDiversionResult(null);
    setPatrolRouteResult(null);
    setSimilarEventsResult(null);
    setPlannedEventResult(null);
    setRouteResult(null);
    setRouteStart(null);
    setRouteEnd(null);
    setSelectedTarget(null);
    setSelectedName("");
    setTemporaryIncident(null);
    setPlannedEventTarget(null);
    clearRoute();
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
    <div className="flex h-[100dvh] flex-col bg-surface text-on-surface overflow-hidden">
      {/* ─── HEADER ─── */}
      <header className="glass-organic sticky top-0 z-[9999] flex items-center justify-between px-8 py-4">
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

        {/* Tab Switcher */}
        <div className="absolute left-1/2 -translate-x-1/2 flex bg-surface-container-highest rounded-full p-1 shadow-ambient-sm">
          <button 
            className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${currentView === 'map' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface hover:bg-surface-container'}`}
            onClick={() => setCurrentView('map')}
          >
            Operations Map
          </button>
          <button 
            className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${currentView === 'analytics' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface hover:bg-surface-container'}`}
            onClick={() => setCurrentView('analytics')}
          >
            Analytics Dashboard
          </button>
          <button 
            className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${currentView === 'audit' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface hover:bg-surface-container'}`}
            onClick={() => setCurrentView('audit')}
          >
            Audit Trail
          </button>
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

      {/* ─── CONTENT ─── */}
      {currentView === 'analytics' ? (
        <div className="flex-1 w-full bg-surface overflow-hidden">
          <AnalyticsPanel startDate={minTime} endDate={selectedTime} />
        </div>
      ) : currentView === 'audit' ? (
        <div className="flex-1 w-full overflow-hidden">
          <AuditDashboard />
        </div>
      ) : (
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
                const clamped = Math.max(minTime, Math.min(value, maxTime));
                setSelectedTime(clamped);
                handleClearAll();
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
            <PlanEventForm
              open={planEventOpen}
              onToggle={() => setPlanEventOpen((value) => !value)}
              form={planEventForm}
              onChange={handlePlanEventFormChange}
              onSubmit={handlePlanEventSubmit}
              mapPoint={planEventForm.lat && planEventForm.lon ? { lat: Number(planEventForm.lat), lon: Number(planEventForm.lon) } : null}
              submitting={submittingPlanEvent}
            />
          </div>
        </aside>

        {/* ─── CENTER MAP ─── */}
        <main className="relative flex-1 min-h-[520px] lg:min-h-0 flex flex-col">
          <MapView
            incidents={activeIncidents}
            temporaryIncident={temporaryIncident}
            plannedEventTarget={plannedEventTarget}
            selectedTarget={selectedTarget}
            radiusKm={radiusKm}
            diversionResult={diversionResult}
            formOpen={formOpen}
            onMapClick={handleMapClick}
            onCalculateDiversion={handleCalculateDiversion}
            onRecommendDeployment={handleRecommendDeployment}
            onFindSimilarEvents={handleFindSimilarEvents}
            routeMode={routeMode}
            routeStart={routeStart}
            routeEnd={routeEnd}
            routeResult={routeResult}
            patrolRouteResult={patrolRouteResult}
            onTargetSelect={(incident) => {
              if (!routeMode && !patrolRouteResult) {
                handleCalculateDiversion(incident);
                handleRecommendDeployment(incident);
              }
            }}
            onRoutePlanClick={handleRoutePlanClick}
            selectedPathIndex={selectedPathIndex}
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
          similarEventsResult={similarEventsResult}
          plannedEventResult={plannedEventResult}
          patrolRouteResult={patrolRouteResult}
          isGeneratingPatrol={isGeneratingPatrol}
          onGeneratePatrolRoute={handleGeneratePatrolRoute}
          routeResult={routeResult}
          routeMode={routeMode}
          error={error}
          onClearAll={handleClearAll}
          onClearDeployment={() => setDeploymentResult(null)}
          onClearDiversion={() => setDiversionResult(null)}
          onClearSimilarEvents={() => setSimilarEventsResult(null)}
          onClearPlannedEvent={() => setPlannedEventResult(null)}
          onClearPatrolRoute={() => setPatrolRouteResult(null)}
          onClearPointToPoint={clearRoute}
          selectedPathIndex={selectedPathIndex}
          onSelectPath={setSelectedPathIndex}
        />
      </div>
      )}
    </div>
  );
}
