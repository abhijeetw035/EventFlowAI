import DeploymentPanel from "./DeploymentPanel.jsx";

const vectorColors = ["#006e1c", "#0061a4", "#8b5000", "#6750a4", "#006a6a", "#ba1a1a"];

export default function DiversionResultsPanel({ status, selectedName, clusterCount, diversionResult, deploymentResult, routeResult, error }) {
  const diversions = diversionResult?.diversions || [];

  return (
    <aside className="relative z-10 flex min-h-0 w-full flex-col bg-surface-container-low lg:w-[400px] shrink-0">
      {/* Panel header */}
      <div className="px-6 pt-6 pb-4">
        <h2 className="font-display text-lg font-bold text-on-surface">Telemetry</h2>
        <p className="mt-1 text-xs text-on-surface-var">
          {selectedName || "Select an incident to begin."}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto custom-scrollbar px-6 pb-6">
        {/* Status */}
        {status && (
          <div className="animate-fadeIn card-nested flex items-center gap-3 p-4">
            <svg className="h-4 w-4 shrink-0 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" opacity="0.2"/>
              <path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            <span className="text-xs leading-relaxed text-on-surface-var">{status}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="animate-fadeIn flex items-start gap-3 rounded-2xl bg-error-container p-4">
            <svg className="h-4 w-4 shrink-0 text-error mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span className="text-xs leading-relaxed text-error-on-cont">{error}</span>
          </div>
        )}

        <DeploymentPanel recommendation={deploymentResult} />

        {/* ─── POINT-TO-POINT ROUTE RESULT ─── */}
        {routeResult && (
          <section className="animate-fadeIn space-y-4">
            <div>
              <h3 className="font-display text-base font-bold text-on-surface">Route Diversion Report</h3>
              <p className="mt-1 text-xs text-on-surface-var">
                Checked <span className="font-display font-bold text-on-surface">{routeResult.blockingCount ?? 0}</span> active
                incident(s) near the corridor.
              </p>
            </div>

            <div className="grid gap-3">
              {routeResult.status === "success" && (
                <article className="card-organic overflow-hidden p-0">
                  <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container"></div>
                  <div className="p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="h-3.5 w-3.5 rounded-full bg-primary" />
                      <strong className="font-display text-sm font-bold text-on-surface">Route A → B</strong>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-primary">Diversion Route Calculated</p>
                  </div>
                </article>
              )}

              {routeResult.status === "gridlock" && (
                <article className="card-organic overflow-hidden p-0">
                  <div className="h-1.5 bg-gradient-to-r from-error to-error-container"></div>
                  <div className="p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="h-3.5 w-3.5 rounded-full bg-error" />
                      <strong className="font-display text-sm font-bold text-on-surface">Route A → B</strong>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-error">No Diversion Possible (Gridlock)</p>
                    {routeResult.message && (
                      <p className="mt-1 text-[0.6875rem] text-on-surface-var">{routeResult.message}</p>
                    )}
                  </div>
                </article>
              )}

              {routeResult.status === "error" && (
                <article className="card-organic overflow-hidden p-0">
                  <div className="h-1.5 bg-gradient-to-r from-tertiary to-tertiary-container"></div>
                  <div className="p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="h-3.5 w-3.5 rounded-full bg-tertiary" />
                      <strong className="font-display text-sm font-bold text-on-surface">Route A → B</strong>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-tertiary">Engine Error</p>
                    {routeResult.message && (
                      <p className="mt-1 text-[0.6875rem] text-on-surface-var">{routeResult.message}</p>
                    )}
                  </div>
                </article>
              )}
            </div>
          </section>
        )}

        {/* ─── CLUSTER DIVERSION RESULTS ─── */}
        {diversionResult && (
          <section className="animate-fadeIn space-y-4">
            <div>
              <h3 className="font-display text-base font-bold text-on-surface">Corridor Report</h3>
              <p className="mt-1 text-xs text-on-surface-var">
                <span className="font-display font-bold text-on-surface">{clusterCount}</span> linked incidents ·{" "}
                <span className="font-display font-bold text-on-surface">{diversionResult.total_diversions}</span> bypass routes
              </p>
            </div>

            <div className="space-y-3">
              {diversions.map((diversion, index) => {
                const isSuccess = diversion.status === "success";
                const color = isSuccess ? vectorColors[index % vectorColors.length] : "#ba1a1a";
                return (
                  <article
                    key={`${diversion.from_road}-${index}`}
                    className="card-organic overflow-hidden p-0 transition-shadow duration-200 hover:shadow-ambient-lg"
                  >
                    <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}></div>
                    <div className="flex items-center gap-3 p-4">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <strong className="text-sm font-semibold text-on-surface">{diversion.from_road || "Local Street"}</strong>
                        <p className="mt-0.5 text-[0.6875rem] font-medium" style={{ color: isSuccess ? "#006e1c" : "#ba1a1a" }}>
                          {isSuccess ? "Corridor Flank Engaged" : "Local Gridlock (No Path)"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
