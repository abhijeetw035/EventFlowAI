import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Fragment, useEffect, useMemo } from "react";

const vectorColors = ["#38bdf8", "#22c55e", "#f97316", "#a78bfa", "#06b6d4", "#ec4899"];

const hazardIcon = L.divIcon({
  html: '<div style="background:#020617;width:14px;height:14px;border-radius:999px;border:3px solid #ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.2)"></div>',
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const tempIcon = L.divIcon({
  html: '<div style="background:#38bdf8;width:14px;height:14px;border-radius:999px;border:3px solid #e0f2fe;box-shadow:0 0 0 4px rgba(56,189,248,.25)"></div>',
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function makePointIcon(label, color) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);">${label}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const pointAIcon = makePointIcon("A", "#22c55e");
const pointBIcon = makePointIcon("B", "#ef4444");

/** Handles form-mode clicks (for placing a manual incident). */
function MapClickHandler({ enabled, onMapClick }) {
  useMapEvents({
    click(event) {
      if (enabled) {
        onMapClick({ lat: event.latlng.lat, lon: event.latlng.lng });
      }
    },
  });
  return null;
}

/**
 * Handles route-planning clicks (Point A / Point B capture).
 * Fires onRoutePlanClick with the raw Leaflet latlng object.
 * Must be a separate handler so incident marker clicks can call
 * L.DomEvent.stopPropagation without breaking form mode.
 */
function RoutePlanClickHandler({ enabled, onRoutePlanClick }) {
  useMapEvents({
    click(event) {
      if (enabled) {
        onRoutePlanClick(event.latlng);
      }
    },
  });
  return null;
}

/** Changes the map cursor when route-planning mode is active. */
function CursorController({ routeMode }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (routeMode) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }
    return () => {
      container.style.cursor = "";
    };
  }, [map, routeMode]);
  return null;
}

function FitDiversions({ target, diversions, radiusKm }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;

    if (!Number.isFinite(target.lat) || !Number.isFinite(target.lon)) return;

    const group = L.featureGroup([L.marker([target.lat, target.lon])]);
    diversions
      .filter((diversion) => diversion.status === "success" && Array.isArray(diversion.coordinates))
      .forEach((diversion) => {
        group.addLayer(L.polyline(diversion.coordinates));
      });
    
    const bounds = group.getBounds();
    const circleBounds = L.latLng(target.lat, target.lon).toBounds(radiusKm * 1000);
    bounds.extend(circleBounds);

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [map, target, diversions, radiusKm]);

  return null;
}

/** Auto-zooms to show the A→B route polyline and both endpoint markers. */
function FitRoute({ routeStart, routeEnd, routeResult }) {
  const map = useMap();

  useEffect(() => {
    if (!routeStart || !routeEnd) return;
    if (routeResult?.status !== "success" || !Array.isArray(routeResult.coordinates)) return;

    const group = L.featureGroup([
      L.marker([routeStart.lat, routeStart.lon]),
      L.marker([routeEnd.lat, routeEnd.lon]),
      L.polyline(routeResult.coordinates),
    ]);

    if (group.getBounds().isValid()) {
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
    }
  }, [map, routeStart, routeEnd, routeResult]);

  return null;
}

function IncidentMarker({
  incident,
  temporary,
  lat,
  lon,
  onCalculateDiversion,
  onRecommendDeployment,
}) {
  const map = useMap();

  function runAfterClosingPopup(action) {
    map.closePopup();
    window.requestAnimationFrame(() => action(incident));
  }

  return (
    <Marker
      position={[lat, lon]}
      icon={temporary ? tempIcon : hazardIcon}
    >
      <Popup>
        <div className="min-w-56 space-y-2">
          <div>
            <h3 className="m-0 text-sm font-bold text-console-text">{incident.id || "Manual Incident"}</h3>
            <p className="m-0 text-xs text-console-muted">
              Cause: {String(incident.event_cause || "unknown").replaceAll("_", " ").toUpperCase()}
            </p>
            <p className="m-0 text-xs text-console-muted">
              Reported: {incident.parsedStart ? new Date(incident.parsedStart).toLocaleString() : "New report"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => runAfterClosingPopup(onCalculateDiversion)}
              className="bg-sky-500 px-2 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
            >
              Calculate Macro-Flanks
            </button>
            <button
              type="button"
              onClick={() => runAfterClosingPopup(onRecommendDeployment)}
              className="bg-slate-200 px-2 py-2 text-xs font-bold text-slate-950 hover:bg-white"
            >
              Recommend Deployment
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function MapView({
  incidents,
  temporaryIncident,
  selectedTarget,
  radiusKm,
  diversionResult,
  formOpen,
  onMapClick,
  onCalculateDiversion,
  onRecommendDeployment,
  // Route planner props
  routeMode,
  routeStart,
  routeEnd,
  routeResult,
  onRoutePlanClick,
}) {
  const successfulDiversions =
    diversionResult?.diversions?.filter(
      (diversion) =>
        diversion.status === "success" &&
        Array.isArray(diversion.coordinates) &&
        diversion.coordinates.length >= 2,
    ) || [];

  const markers = useMemo(() => {
    const rows = incidents.map((incident) => ({ incident, temporary: false }));
    if (temporaryIncident) rows.push({ incident: temporaryIncident, temporary: true });
    return rows;
  }, [incidents, temporaryIncident]);

  const routeCoords =
    routeResult?.status === "success" && Array.isArray(routeResult.coordinates)
      ? routeResult.coordinates
      : null;

  return (
    <MapContainer center={[12.9716, 77.5946]} zoom={12} className="h-full">
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Form-mode click (manual incident placement) */}
      <MapClickHandler enabled={formOpen} onMapClick={onMapClick} />

      {/* Route-planning click (A/B capture) */}
      <RoutePlanClickHandler enabled={routeMode} onRoutePlanClick={onRoutePlanClick} />

      {/* Cursor crosshair when planning a route */}
      <CursorController routeMode={routeMode} />

      {markers.map(({ incident, temporary }) => {
        const lat = Number(incident.latitude ?? incident.lat);
        const lon = Number(incident.longitude ?? incident.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        return (
          <IncidentMarker
            key={`${temporary ? "temp" : "incident"}-${incident.stableKey || incident.id || `${lat}-${lon}`}`}
            incident={incident}
            temporary={temporary}
            lat={lat}
            lon={lon}
            onCalculateDiversion={onCalculateDiversion}
            onRecommendDeployment={onRecommendDeployment}
          />
        );
      })}

      {/* Cluster radius circle drawn around the selected diversion target */}
      {selectedTarget && (
        <Circle
          center={[selectedTarget.lat, selectedTarget.lon]}
          radius={radiusKm * 1000}
          pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.1, dashArray: "5 5" }}
        />
      )}

      {/* Cluster diversion polylines */}
      {successfulDiversions.map((diversion, index) => (
          <Fragment key={`${diversion.from_road}-${index}`}>
            <Polyline
              positions={diversion.coordinates}
              pathOptions={{ color: "#020617", weight: 10, opacity: 0.85 }}
            />
            <Polyline
              positions={diversion.coordinates}
              pathOptions={{
                color: vectorColors[index % vectorColors.length],
                weight: 6,
                opacity: 1,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </Fragment>
        ))}

      <FitDiversions target={selectedTarget} diversions={successfulDiversions} radiusKm={radiusKm} />

      {/* ============================================
          POINT-TO-POINT ROUTE PLANNER LAYERS
          ============================================ */}

      {/* Point A marker */}
      {routeStart && (
        <Marker position={[routeStart.lat, routeStart.lon]} icon={pointAIcon} />
      )}

      {/* Point B marker */}
      {routeEnd && (
        <Marker position={[routeEnd.lat, routeEnd.lon]} icon={pointBIcon} />
      )}

      {/* Computed diversion route polyline (purple) */}
      {routeCoords && (
        <>
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: "#1e0a3c", weight: 10, opacity: 0.85 }}
          />
          <Polyline
            positions={routeCoords}
            pathOptions={{
              color: "#6f42c1",
              weight: 6,
              opacity: 1,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </>
      )}

      {/* Auto-zoom to route bounds after calculation */}
      <FitRoute routeStart={routeStart} routeEnd={routeEnd} routeResult={routeResult} />
    </MapContainer>
  );
}
