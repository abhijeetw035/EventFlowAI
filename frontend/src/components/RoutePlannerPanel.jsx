/**
 * RoutePlannerPanel
 * Sidebar section for the Point-to-Point Diversion Planner.
 *
 * Props:
 *   routeMode   {boolean}  - whether A/B click-capture mode is active
 *   routeStart  {object|null} - { lat, lon } of Point A, or null
 *   routeEnd    {object|null} - { lat, lon } of Point B, or null
 *   routeStatus {string}   - human-readable status message
 *   calculating {boolean}  - true while the API call is in flight
 *   onToggle    {function} - toggles route planning mode (also clears previous route)
 *   onClear     {function} - clears the current route and resets state
 */
export default function RoutePlannerPanel({
  routeMode,
  routeStart,
  routeEnd,
  routeStatus,
  calculating,
  onToggle,
  onClear,
}) {
  function toggleLabel() {
    if (calculating) return "⏳ Calculating...";
    if (!routeMode && !routeStart) return "🧭 Plan New Diversion Route";
    if (routeMode && !routeStart) return "📍 Click Point A on the map...";
    if (routeMode && routeStart && !routeEnd) return "📍 Click Point B on the map...";
    return "🧭 Plan New Diversion Route";
  }

  const isActive = routeMode || calculating;

  return (
    <section className="border-b border-console-line py-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-console-text">Point-to-Point Diversion</h2>
        <p className="text-xs text-console-muted">
          Plan a route between two map points that avoids any incident active near that corridor.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={calculating}
          className={`flex-1 rounded px-3 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
            isActive
              ? "bg-pink-600 text-white hover:bg-pink-500"
              : "bg-violet-600 text-white hover:bg-violet-500"
          }`}
        >
          {toggleLabel()}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={calculating}
          className="rounded bg-console-panel2 px-3 py-2 text-xs font-bold text-console-muted hover:bg-console-line hover:text-console-text disabled:opacity-60"
        >
          ✖ Clear
        </button>
      </div>

      {routeStatus && (
        <p className="mt-2 text-xs text-console-muted leading-relaxed">{routeStatus}</p>
      )}
    </section>
  );
}
