import DeploymentPanel from "./DeploymentPanel.jsx";

const vectorColors = ["#38bdf8", "#22c55e", "#f97316", "#a78bfa", "#06b6d4", "#ec4899"];

export default function DiversionResultsPanel({ status, selectedName, clusterCount, diversionResult, deploymentResult, routeResult, error }) {
  const diversions = diversionResult?.diversions || [];

  return (
    <aside className="flex min-h-0 flex-col border-l border-console-line bg-console-panel">
      <div className="border-b border-console-line px-4 py-3">
        <h2 className="text-sm font-semibold text-console-text">Telemetry Console</h2>
        <p className="text-xs text-console-muted">{selectedName || "Load dataset or select an incident to begin."}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {status && (
          <div className="border border-console-line bg-console-panel2 p-3 text-sm text-console-text">{status}</div>
        )}

        {error && <div className="border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        <DeploymentPanel recommendation={deploymentResult} />

        {/* ============================================
            POINT-TO-POINT ROUTE RESULT
            ============================================ */}
        {routeResult && (
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-console-text">Point-to-Point Diversion Report</h3>
              <p className="text-xs text-console-muted">
                Checked <span className="font-semibold text-console-text">{routeResult.blockingCount ?? 0}</span> active
                incident(s) near the selected corridor.
              </p>
            </div>

            <div className="grid gap-3">
              {routeResult.status === "success" && (
                <article className="border-l-4 p-3 border-violet-500 bg-violet-500/10 text-violet-100">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "#6f42c1" }} />
                    <strong className="text-sm">Route A → B</strong>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-green-300">🟢 Diversion Route Calculated</p>
                </article>
              )}

              {routeResult.status === "gridlock" && (
                <article className="border-l-4 p-3 border-red-500 bg-red-500/10 text-red-100">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500" />
                    <strong className="text-sm">Route A → B</strong>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-red-300">🔴 No Diversion Possible (Gridlock)</p>
                  {routeResult.message && (
                    <p className="mt-1 text-xs text-red-400">{routeResult.message}</p>
                  )}
                </article>
              )}

              {routeResult.status === "error" && (
                <article className="border-l-4 p-3 border-orange-500 bg-orange-500/10 text-orange-100">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-orange-500" />
                    <strong className="text-sm">Route A → B</strong>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-orange-300">⚠️ Engine Error</p>
                  {routeResult.message && (
                    <p className="mt-1 text-xs text-orange-400">{routeResult.message}</p>
                  )}
                </article>
              )}
            </div>
          </section>
        )}

        {/* ============================================
            CLUSTER DIVERSION RESULTS
            ============================================ */}
        {diversionResult && (
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-console-text">Localized Corridor Report</h3>
              <p className="text-xs text-console-muted">
                Detected {clusterCount} linked incidents. Calculated {diversionResult.total_diversions} sweeping bypass
                routes.
              </p>
            </div>

            <div className="grid gap-3">
              {diversions.map((diversion, index) => {
                const isSuccess = diversion.status === "success";
                const color = isSuccess ? vectorColors[index % vectorColors.length] : "#ef4444";
                return (
                  <article
                    key={`${diversion.from_road}-${index}`}
                    className={`border-l-4 p-3 ${
                      isSuccess
                        ? "border-green-500 bg-green-500/10 text-green-100"
                        : "border-red-500 bg-red-500/10 text-red-100"
                    }`}
                    style={{ borderLeftColor: color }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                      <strong className="text-sm">From: {diversion.from_road || "Local Street"}</strong>
                    </div>
                    <p className="mt-1 text-xs font-semibold">
                      {isSuccess ? "Corridor Flank Engaged" : "Local Gridlock (No Path)"}
                    </p>
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
