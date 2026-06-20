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

  return (
    <MapContainer center={[12.9716, 77.5946]} zoom={12} className="h-full">
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler enabled={formOpen} onMapClick={onMapClick} />

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

      {selectedTarget && (
        <Circle
          center={[selectedTarget.lat, selectedTarget.lon]}
          radius={radiusKm * 1000}
          pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.1, dashArray: "5 5" }}
        />
      )}

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
    </MapContainer>
  );
}
