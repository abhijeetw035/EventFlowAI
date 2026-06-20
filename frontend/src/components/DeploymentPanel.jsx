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

  const tier = tierConfig[recommendation.deployment_tier] || tierConfig.Low;
  const severityLabel = ["Low", "Medium", "High"][Number(recommendation.severity_encoded)] || "Unknown";

  return (
    <article className="card-organic animate-fadeIn overflow-hidden p-0">
      {/* Top gradient bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary"></div>

      <div className="p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-on-surface">Deployment Recommendation</h3>
            <p className="mt-1 text-xs text-on-surface-var">
              Radius <span className="font-display font-bold text-on-surface">{Number(recommendation.affected_radius_km || 0).toFixed(2)} km</span> · Cluster{" "}
              <span className="font-display font-bold text-on-surface">{recommendation.location_cluster}</span>
            </p>
          </div>
          <span className={`rounded-full px-3.5 py-1.5 text-[0.6875rem] font-bold ${tier.bg} ${tier.text}`}>
            {recommendation.deployment_tier}
          </span>
        </div>

        {/* Hero metric cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card-nested rounded-2xl p-5 text-center">
            <div className="font-display text-4xl font-extrabold text-primary">
              {recommendation.recommended_personnel}
            </div>
            <div className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-on-surface-var">Personnel</div>
          </div>
          <div className="card-nested rounded-2xl p-5 text-center">
            <div className="font-display text-4xl font-extrabold text-tertiary">
              {recommendation.recommended_barricades}
            </div>
            <div className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-on-surface-var">Barricades</div>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-on-surface-var">
          <span>Severity: <span className="font-semibold text-on-surface">{severityLabel}</span> ({recommendation.severity_encoded})</span>
          <span>Major corridor: <span className="font-semibold text-on-surface">{recommendation.is_major_corridor ? "Yes" : "No"}</span></span>
        </div>

        {/* Explanation */}
        {Array.isArray(recommendation.explanation) && recommendation.explanation.length > 0 && (
          <section className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(114, 121, 111, 0.12)" }}>
            <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-on-surface-var">Why this recommendation</h4>
            <ul className="mt-3 space-y-2.5">
              {recommendation.explanation.map((reason, index) => (
                <li
                  key={`${index}-${reason}`}
                  className="card-nested rounded-xl px-4 py-3 text-xs leading-relaxed text-on-surface-var transition-colors hover:bg-surface-container"
                >
                  {reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        {recommendation.label_basis && (
          <p className="mt-4 card-nested rounded-xl px-4 py-3 text-xs italic leading-relaxed text-on-surface-var">
            {recommendation.label_basis}
          </p>
        )}
      </div>
    </article>
  );
}
