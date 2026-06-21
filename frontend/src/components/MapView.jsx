import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Fragment, useEffect, useMemo } from "react";

const vectorColors = ["#006e1c", "#0061a4", "#8b5000", "#6750a4", "#006a6a", "#ba1a1a"];

const hazardIcon = L.divIcon({
  html: `<div style="position:relative;width:16px;height:16px;">
    <div style="position:absolute;inset:0;background:#6750a4;border-radius:50%;border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(103,80,164,0.4);"></div>
    <div class="marker-ring"></div>
  </div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const tempIcon = L.divIcon({
  html: `<div style="position:relative;width:18px;height:18px;">
    <div style="background:#006e1c;width:18px;height:18px;border-radius:50%;border:2.5px solid #ffffff;box-shadow:0 2px 10px rgba(0,110,28,0.3);"></div>
  </div>`,
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const plannedEventIcon = L.divIcon({
  html: `<div style="position:relative;width:20px;height:20px;">
    <div style="background:#ba1a1a;width:20px;height:20px;border-radius:50%;border:2.5px dashed #ffffff;box-shadow:0 2px 10px rgba(186,26,26,0.5);"></div>
  </div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function makePointIcon(label, color) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;font-family:'Manrope',sans-serif;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.15);">${label}</div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const pointAIcon = makePointIcon("A", "#006e1c");
const pointBIcon = makePointIcon("B", "#8b5000");

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
  onFindSimilarEvents,
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
        <div className="min-w-[220px] space-y-3">
          <div>
            <h3 className="m-0 font-display text-sm font-bold text-on-surface">{incident.id || "Manual Incident"}</h3>
            <p className="m-0 mt-1 text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-on-surface-var">
              {String(incident.event_cause || "unknown").replaceAll("_", " ")}
            </p>
            <p className="m-0 mt-0.5 text-[0.6875rem] text-on-surface-var">
              {incident.parsedStart ? new Date(incident.parsedStart).toLocaleString() : "New report"}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => runAfterClosingPopup(onCalculateDiversion)}
                className="btn-press rounded-xl bg-primary px-3 py-2.5 text-[0.6875rem] font-bold text-on-primary shadow-ambient-sm transition-all hover:shadow-ambient"
              >
                Macro-Flanks
              </button>
              <button
                type="button"
                onClick={() => runAfterClosingPopup(onRecommendDeployment)}
                className="btn-press rounded-xl bg-surface-container-high px-3 py-2.5 text-[0.6875rem] font-bold text-on-surface transition-all hover:bg-surface-container-highest"
              >
                Deployment
              </button>
            </div>
            <button
              type="button"
              onClick={() => runAfterClosingPopup(onFindSimilarEvents)}
              className="btn-press w-full rounded-xl bg-secondary px-3 py-2 text-[0.6875rem] font-bold text-on-secondary shadow-ambient-sm transition-all hover:shadow-ambient"
            >
              Find Similar Past Events
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
  plannedEventTarget,
  selectedTarget,
  radiusKm,
  diversionResult,
  formOpen,
  onMapClick,
  onCalculateDiversion,
  onRecommendDeployment,
  onFindSimilarEvents,
  // Route planner props
  routeMode,
  routeStart,
  routeEnd,
  routeResult,
  onRoutePlanClick,
  selectedPathIndex,
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
      {/* Standard OSM tiles — clean white map */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
            onFindSimilarEvents={onFindSimilarEvents}
          />
        );
      })}

      {/* Planned event dashed marker */}
      {plannedEventTarget && (
        <Marker
          position={[plannedEventTarget.lat, plannedEventTarget.lon]}
          icon={plannedEventIcon}
        />
      )}

      {/* Cluster radius circle drawn around the selected diversion target */}
      {selectedTarget && (
        <Circle
          center={[selectedTarget.lat, selectedTarget.lon]}
          radius={radiusKm * 1000}
          pathOptions={{ color: "#6750a4", fillColor: "#6750a4", fillOpacity: 0.06, dashArray: "6 4", weight: 1.5 }}
        />
      )}

      {/* Cluster diversion polylines — selected path renders last so it sits on top */}
      {(() => {
        const anySelected = selectedPathIndex !== null && selectedPathIndex < successfulDiversions.length;
        // Build render order: all non-selected first, then selected last
        const order = successfulDiversions
          .map((_, i) => i)
          .filter((i) => i !== selectedPathIndex);
        if (anySelected) {
          order.push(selectedPathIndex);
        }
        return order.map((index) => {
          const diversion = successfulDiversions[index];
          const isSelected = index === selectedPathIndex;
          // When something is selected: selected = full opacity, others = very faint
          const lineOpacity = anySelected ? (isSelected ? 1 : 0.18) : 0.9;
          const glowOpacity = anySelected ? (isSelected ? 0.9 : 0.15) : 0.9;
          return (
            <Fragment key={`${diversion.from_road}-${index}`}>
              <Polyline
                positions={diversion.coordinates}
                pathOptions={{
                  color: "#ffffff",
                  weight: isSelected ? 14 : 10,
                  opacity: glowOpacity,
                }}
              />
              <Polyline
                positions={diversion.coordinates}
                pathOptions={{
                  color: vectorColors[index % vectorColors.length],
                  weight: isSelected ? 7 : 5,
                  opacity: lineOpacity,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </Fragment>
          );
        });
      })()}

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

      {/* Computed diversion route polyline */}
      {routeCoords && (
        <>
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: "#ffffff", weight: 10, opacity: 0.9 }}
          />
          <Polyline
            positions={routeCoords}
            pathOptions={{
              color: "#6750a4",
              weight: 5,
              opacity: 0.9,
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
