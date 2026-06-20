const tierClasses = {
  Low: "bg-slate-700 text-slate-100 border-slate-500",
  Medium: "bg-amber-500/20 text-amber-200 border-amber-400/50",
  High: "bg-orange-500/20 text-orange-200 border-orange-400/50",
  Critical: "bg-red-500/20 text-red-200 border-red-400/50",
};

export default function DeploymentPanel({ recommendation }) {
  if (!recommendation) return null;

  const tierClass = tierClasses[recommendation.deployment_tier] || tierClasses.Low;
  const severityLabel = ["Low", "Medium", "High"][Number(recommendation.severity_encoded)] || "Unknown";

  return (
    <article className="border border-console-line bg-console-panel2 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-console-text">Deployment Recommendation</h3>
          <p className="text-xs text-console-muted">
            Radius {Number(recommendation.affected_radius_km || 0).toFixed(2)} km · Cluster{" "}
            {recommendation.location_cluster}
          </p>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-bold ${tierClass}`}>
          {recommendation.deployment_tier}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-console-line bg-console-bg p-3">
          <div className="text-3xl font-bold text-console-text">{recommendation.recommended_personnel}</div>
          <div className="text-xs uppercase tracking-wide text-console-muted">Personnel</div>
        </div>
        <div className="border border-console-line bg-console-bg p-3">
          <div className="text-3xl font-bold text-console-text">{recommendation.recommended_barricades}</div>
          <div className="text-xs uppercase tracking-wide text-console-muted">Barricades</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-console-muted">
        <span>Severity: {severityLabel} ({recommendation.severity_encoded})</span>
        <span>Major corridor: {recommendation.is_major_corridor ? "Yes" : "No"}</span>
      </div>
      {Array.isArray(recommendation.explanation) && recommendation.explanation.length > 0 && (
        <section className="mt-4 border-t border-console-line pt-3">
          <h4 className="text-xs font-semibold uppercase text-console-text">Why this recommendation</h4>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-console-muted">
            {recommendation.explanation.map((reason, index) => (
              <li key={`${index}-${reason}`} className="border-l-2 border-sky-500 pl-2">
                {reason}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-3 text-xs italic leading-relaxed text-console-muted">{recommendation.label_basis}</p>
    </article>
  );
}
