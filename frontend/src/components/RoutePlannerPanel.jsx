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
    if (calculating) return "Calculating…";
    if (!routeMode && !routeStart) return "Plan New Route";
    if (routeMode && !routeStart) return "Click Point A…";
    if (routeMode && routeStart && !routeEnd) return "Click Point B…";
    return "Plan New Route";
  }

  const isActive = routeMode || calculating;

  return (
    <section className="card-organic p-6 animate-fadeIn" style={{ animationDelay: "120ms" }}>
      <div className="mb-5">
        <h2 className="font-display text-base font-bold text-on-surface">Point-to-Point Diversion</h2>
        <p className="mt-1 text-xs text-on-surface-var">
          Plan a route between two map points that avoids active incidents.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={calculating}
          className={`btn-press flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 disabled:opacity-50 ${
            isActive
              ? "bg-tertiary text-on-tertiary shadow-ambient"
              : "bg-primary text-on-primary shadow-ambient hover:shadow-ambient-lg"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {calculating && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="10" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            )}
            {toggleLabel()}
          </span>
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={calculating}
          className="btn-press rounded-xl bg-surface-container-high px-4 py-3 text-sm font-semibold text-on-surface-var transition-all duration-200 hover:bg-surface-container-highest disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {routeStatus && (
        <p className="mt-4 rounded-xl bg-surface-container-low p-3.5 text-xs leading-relaxed text-on-surface-var">
          {routeStatus}
        </p>
      )}
    </section>
  );
}
