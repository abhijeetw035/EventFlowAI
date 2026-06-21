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

export default function DeploymentPanel({ recommendation }) {
  if (!recommendation) return null;

  // Fallback if recommendation is still old format
  const single = recommendation.single_point || recommendation;
  const cluster = recommendation.cluster_area;

  const tierSingle = tierConfig[single.deployment_tier] || tierConfig.Low;
  const severityLabelSingle = ["Low", "Medium", "High"][Number(single.severity_encoded)] || "Unknown";

  const tierCluster = cluster ? (tierConfig[cluster.tier_max] || tierConfig.Low) : null;

  return (
    <article className="card-organic animate-fadeIn overflow-hidden p-0">
      {/* Top gradient bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary"></div>

      <div className="p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-on-surface">Deployment Recommendation</h3>
            <p className="mt-1 text-xs text-on-surface-var">
              Radius <span className="font-display font-bold text-on-surface">{Number(single.affected_radius_km || 0).toFixed(2)} km</span> · Cluster{" "}
              <span className="font-display font-bold text-on-surface">{single.location_cluster}</span>
            </p>
          </div>
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

        {single.label_basis && (
          <p className="mt-4 card-nested rounded-xl px-4 py-3 text-xs italic leading-relaxed text-on-surface-var">
            {single.label_basis}
          </p>
        )}
      </div>
    </article>
  );
}
