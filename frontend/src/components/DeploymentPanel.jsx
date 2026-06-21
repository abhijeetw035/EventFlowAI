const tierConfig = {
  Low: {
    bg: "bg-surface-container",
    text: "text-on-surface",
  },
  Medium: {
    bg: "bg-tertiary-container",
    text: "text-tertiary-on-cont",
  },
  High: {
    bg: "bg-tertiary-container",
    text: "text-tertiary",
  },
  Critical: {
    bg: "bg-error-container",
    text: "text-error",
  },
};

export default function DeploymentPanel({ recommendation, patrolRouteResult, isGeneratingPatrol, onGeneratePatrolRoute, onClear, onClearPatrolRoute }) {
  if (!recommendation) return null;

  // Fallback if recommendation is still old format
  const single = recommendation.single_point || recommendation;
  const cluster = recommendation.cluster_area;

  const tierSingle = tierConfig[single.deployment_tier] || tierConfig.Low;
  const severityLabelSingle = ["Low", "Medium", "High"][Number(single.severity_encoded)] || "Unknown";

  const tierCluster = cluster ? (tierConfig[cluster.tier_max] || tierConfig.Low) : null;

  return (
    <article className="card-organic animate-fadeIn overflow-hidden p-0 relative">
      {/* Top gradient bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary"></div>

      <div className="p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-on-surface">Deployment Recommendation</h3>
            <p className="mt-1 text-xs text-on-surface-var">
              Impact Radius <span className="font-display font-bold text-on-surface">{Number(single.affected_radius_km || 0).toFixed(2)} km</span> · Cluster{" "}
              <span className="font-display font-bold text-on-surface">{single.location_cluster}</span>
            </p>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="mt-1 rounded text-on-surface-var hover:bg-surface-container hover:text-on-surface p-1 transition-colors"
              title="Clear Deployment Recommendation"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
          <span className={`rounded-full px-3.5 py-1.5 text-[0.6875rem] font-bold ${tierSingle.bg} ${tierSingle.text}`}>
            {single.deployment_tier}
          </span>
        </div>

        {/* ─── SINGLE POINT RECOMMENDATION ─── */}
        <div className="mb-4">
          <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-on-surface-var mb-3">Single Point Recommendation</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="card-nested rounded-2xl p-4 text-center">
              <div className="font-display text-3xl font-extrabold text-primary">
                {single.recommended_personnel}
              </div>
              <div className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-on-surface-var">Personnel</div>
            </div>
            <div className="card-nested rounded-2xl p-4 text-center">
              <div className="font-display text-3xl font-extrabold text-tertiary">
                {single.recommended_barricades}
              </div>
              <div className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-on-surface-var">Barricades</div>
            </div>
          </div>
        </div>

        {/* ─── CLUSTER AREA RECOMMENDATION ─── */}
        {cluster && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-on-surface-var">Cluster Area Recommendation</h4>
              <span className={`rounded-full px-2.5 py-1 text-[0.625rem] font-bold ${tierCluster?.bg} ${tierCluster?.text}`}>
                {cluster.tier_max} (Max)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="card-nested rounded-2xl p-4 text-center bg-primary-container">
                <div className="font-display text-3xl font-extrabold text-primary-on-cont">
                  {cluster.personnel_total}
                </div>
                <div className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-primary-on-cont opacity-80">Total Personnel</div>
              </div>
              <div className="card-nested rounded-2xl p-4 text-center bg-tertiary-container">
                <div className="font-display text-3xl font-extrabold text-tertiary-on-cont">
                  {cluster.barricades_total}
                </div>
                <div className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-tertiary-on-cont opacity-80">Total Barricades</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-on-surface-var text-center">
              Aggregated across <span className="font-semibold text-on-surface">{cluster.incident_count}</span> active incidents within <span className="font-semibold text-on-surface">{cluster.radius_km} km</span>.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {cluster.incident_count > 1 ? (
                <button
                  onClick={onGeneratePatrolRoute}
                  disabled={isGeneratingPatrol}
                  className="btn-press flex items-center justify-center gap-2 rounded-xl bg-tertiary-container/50 px-4 py-2.5 text-[0.6875rem] font-bold uppercase tracking-wider text-tertiary hover:bg-tertiary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPatrol ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" opacity="0.2"/>
                        <path d="M12 2a10 10 0 0 1 10 10"/>
                      </svg>
                      Optimizing Route...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                      </svg>
                      Generate Patrol Route
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-surface-container-high p-3 text-center">
                  <span className="text-[0.6875rem] font-semibold text-on-surface-var">Only one active incident in this radius — no route needed</span>
                </div>
              )}

              {patrolRouteResult && patrolRouteResult.status === "success" && (
                <div className="flex animate-fadeIn flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-inner relative">
                  {onClearPatrolRoute && (
                    <button onClick={onClearPatrolRoute} className="absolute right-2 top-2 rounded p-1 text-on-surface-var hover:bg-surface-container hover:text-on-surface transition-colors" title="Clear Patrol Route">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  )}
                  <div className="flex items-center justify-between text-[0.625rem] font-semibold uppercase tracking-wider text-on-surface-var pr-6">
                    <span>Route Distance</span>
                    <span className="text-on-surface">{(patrolRouteResult.total_distance_m / 1000).toFixed(1)} km</span>
                  </div>
                  <div className="flex items-center justify-between text-[0.625rem] font-semibold uppercase tracking-wider text-on-surface-var">
                    <span>Estimated Travel Time</span>
                    <span className="text-on-surface font-bold text-primary">{Math.ceil(patrolRouteResult.total_travel_time_s / 60)} min</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-on-surface-var">
          <span>Severity: <span className="font-semibold text-on-surface">{severityLabelSingle}</span> ({single.severity_encoded})</span>
          <span>Major corridor: <span className="font-semibold text-on-surface">{single.is_major_corridor ? "Yes" : "No"}</span></span>
        </div>

        {/* Explanation */}
        {Array.isArray(single.explanation) && single.explanation.length > 0 && (
          <section className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(114, 121, 111, 0.12)" }}>
            <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-on-surface-var">Why this recommendation</h4>
            <ul className="mt-3 space-y-2.5">
              {single.explanation.map((reason, index) => (
                <li
                  key={`${index}-${reason}`}
                  className="card-nested rounded-xl px-4 py-3 text-xs leading-relaxed text-on-surface-var transition-colors hover:bg-surface-container"
                >
                  {reason}
                </li>
              ))}
              {cluster && cluster.incident_count > 1 && (
                <li className="card-nested rounded-xl px-4 py-3 text-xs leading-relaxed text-on-surface-var transition-colors hover:bg-surface-container font-medium" style={{ color: "#0061a4" }}>
                  This area total reflects {cluster.incident_count} active incidents within {cluster.radius_km} km, summed from individual model estimates.
                </li>
              )}
            </ul>
          </section>
        )}

      </div>
    </article>
  );
}
