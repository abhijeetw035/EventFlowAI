import { useState, useEffect, useRef, forwardRef } from "react";
import DeploymentPanel from "./DeploymentPanel.jsx";

const vectorColors = ["#006e1c", "#0061a4", "#8b5000", "#6750a4", "#006a6a", "#ba1a1a"];

const CollapsibleSection = forwardRef(({ title, subtitle, onClear, children, defaultCollapsed = false }, ref) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  
  return (
    <section ref={ref} className="animate-fadeIn space-y-4">
      <div className="flex items-start justify-between gap-4 cursor-pointer select-none" onClick={() => setCollapsed(!collapsed)}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold text-on-surface">{title}</h3>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform text-on-surface-var ${collapsed ? '' : 'rotate-180'}`}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          {subtitle}
        </div>
        {onClear && (
          <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="mt-1 rounded p-1 text-on-surface-var hover:bg-surface-container hover:text-on-surface transition-colors" title={`Clear ${title}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        )}
      </div>
      {!collapsed && children}
    </section>
  );
});

export default function DiversionResultsPanel({ status, selectedName, clusterCount, diversionResult, deploymentResult, similarEventsResult, plannedEventResult, routeResult, patrolRouteResult, isGeneratingPatrol, onGeneratePatrolRoute, error, selectedPathIndex, onSelectPath, onClearAll, onClearDeployment, onClearDiversion, onClearSimilarEvents, onClearPlannedEvent, onClearPatrolRoute, onClearPointToPoint }) {
  const isLoading = status && !status.toLowerCase().startsWith("successfully");
  const isSuccess = status && status.toLowerCase().startsWith("successfully");
  const hasAnyData = !!(diversionResult || deploymentResult || similarEventsResult || plannedEventResult || routeResult || patrolRouteResult || selectedName);
  const plannedRef = useRef(null);
  const routeRef = useRef(null);
  const diversionRef = useRef(null);
  const similarRef = useRef(null);
  const deploymentRef = useRef(null);

  useEffect(() => {
    if (plannedEventResult && plannedRef.current) {
      plannedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [plannedEventResult]);

  useEffect(() => {
    if (routeResult && routeRef.current) {
      routeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [routeResult]);

  useEffect(() => {
    if (diversionResult && diversionRef.current) {
      diversionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [diversionResult]);

  useEffect(() => {
    if (similarEventsResult && similarEventsResult.matches && similarRef.current) {
      similarRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [similarEventsResult]);

  useEffect(() => {
    if (deploymentResult && deploymentRef.current) {
      deploymentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [deploymentResult]);

  const diversions = diversionResult?.diversions || [];

  return (
    <aside className="relative z-10 flex min-h-0 w-full flex-col bg-surface-container-low lg:w-[400px] shrink-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-on-surface">Telemetry</h2>
          <p className="mt-1 text-xs text-on-surface-var">
            {selectedName || "Select an incident to begin."}
          </p>
        </div>
        {hasAnyData && (
          <button
            onClick={onClearAll}
            className="rounded-lg p-2 text-on-surface-var hover:bg-surface-container hover:text-on-surface transition-colors"
            title="Clear All Measurements"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto custom-scrollbar px-6 pb-6">
        {/* Status — loading spinner */}
        {isLoading && (
          <div className="animate-fadeIn card-nested flex items-center gap-3 p-4">
            <svg className="h-4 w-4 shrink-0 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" opacity="0.2"/>
              <path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            <span className="text-xs leading-relaxed text-on-surface-var">{status}</span>
          </div>
        )}

        {/* Status — success message (no spinner) */}
        {isSuccess && (
          <div className="animate-fadeIn card-nested flex items-center gap-3 p-4">
            <svg className="h-4 w-4 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="9 12 11 14 15 10"/>
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

        {/* ─── PLANNED EVENT RESULTS ─── */}
        {plannedEventResult && (
          <CollapsibleSection
            ref={plannedRef}
            title="Planned Event Analysis"
            subtitle={<p className="mt-1 text-xs text-on-surface-var">Pre-event risk index and staging recommendations.</p>}
            onClear={onClearPlannedEvent}
          >
            <article className="card-organic overflow-hidden p-0 transition-all duration-200">
              <div className="h-1.5 bg-gradient-to-r from-tertiary to-tertiary-container"></div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tertiary-container text-on-tertiary-container">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                    <div>
                      <strong className="font-display text-sm font-bold text-on-surface">Risk Index</strong>
                      <p className="text-[0.6875rem] uppercase tracking-wider text-tertiary font-bold">
                        {plannedEventResult.pre_event_risk_index} / 100
                      </p>
                    </div>
                  </div>
                  <div className="relative flex h-12 w-12 items-center justify-center">
                    <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-surface-container"
                        strokeWidth="3"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-tertiary"
                        strokeDasharray={`${plannedEventResult.pre_event_risk_index}, 100`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="font-display text-xs font-bold text-on-surface">{Math.round(plannedEventResult.pre_event_risk_index)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-on-surface-var">Personnel</p>
                    <p className="mt-1 font-display text-lg font-bold text-on-surface">{plannedEventResult.recommended_personnel}</p>
                  </div>
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-on-surface-var">Barricades</p>
                    <p className="mt-1 font-display text-lg font-bold text-on-surface">{plannedEventResult.recommended_barricades}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-tertiary-container/30 p-3">
                  <svg className="h-5 w-5 shrink-0 text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <div>
                    <p className="text-[0.6875rem] font-bold text-on-surface">Stage {plannedEventResult.deployment_lead_time_hours} hours prior</p>
                    <p className="text-xs text-on-surface-var">Recommended lead time based on Tier {plannedEventResult.deployment_tier}</p>
                  </div>
                </div>
              </div>
            </article>
          </CollapsibleSection>
        )}

        {/* ─── POINT-TO-POINT ROUTE RESULT ─── */}
        {routeResult && (
          <CollapsibleSection
            ref={routeRef}
            title="Route Diversion Report"
            subtitle={<p className="mt-1 text-xs text-on-surface-var">Checked <span className="font-display font-bold text-on-surface">{routeResult.blockingCount ?? 0}</span> active incident(s) near the corridor.</p>}
            onClear={onClearPointToPoint}
          >
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
          </CollapsibleSection>
        )}

        {/* ─── CLUSTER DIVERSION RESULTS ─── */}
        {diversionResult && (
          <CollapsibleSection
            ref={diversionRef}
            title="Corridor Report"
            subtitle={<p className="mt-1 text-xs text-on-surface-var"><span className="font-display font-bold text-on-surface">{clusterCount}</span> linked incidents · <span className="font-display font-bold text-on-surface">{diversionResult.total_diversions}</span> bypass routes</p>}
            onClear={onClearDiversion}
          >
            <div className="space-y-3">
              {diversions.map((diversion, index) => {
                const isSuccess = diversion.status === "success";
                const color = isSuccess ? vectorColors[index % vectorColors.length] : "#ba1a1a";
                const isSelected = selectedPathIndex === index;
                return (
                  <article
                    key={`${diversion.from_road}-${index}`}
                    onClick={() => onSelectPath(isSelected ? null : index)}
                    className="card-organic overflow-hidden p-0 transition-all duration-200 hover:shadow-ambient-lg cursor-pointer"
                    style={isSelected ? { outline: `2px solid ${color}`, outlineOffset: "2px" } : {}}
                  >
                    <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}></div>
                    <div className="flex items-center gap-3 p-4">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1">
                        <strong className="text-sm font-semibold text-on-surface">{diversion.from_road || "Local Street"}</strong>
                        <p className="mt-0.5 text-[0.6875rem] font-medium" style={{ color: isSuccess ? "#006e1c" : "#ba1a1a" }}>
                          {isSuccess ? "Corridor Flank Engaged" : "Local Gridlock (No Path)"}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="ml-auto text-[0.625rem] font-bold uppercase tracking-wider" style={{ color }}>
                          Active
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* ─── SIMILAR PAST EVENTS ─── */}
        {similarEventsResult && similarEventsResult.matches && (
          <CollapsibleSection
            ref={similarRef}
            title="Similar Past Events"
            subtitle={<p className="mt-1 text-xs text-on-surface-var">Found <span className="font-display font-bold text-on-surface">{similarEventsResult.matches.length}</span> historical matches.</p>}
            onClear={onClearSimilarEvents}
          >
            <div className="space-y-3">
              {similarEventsResult.matches.map((match, index) => {
                const similarityPercent = Math.round(match.similarity_score * 100);
                // Color scale for similarity
                const colorClass = similarityPercent > 70 ? "text-primary" : similarityPercent > 40 ? "text-tertiary" : "text-on-surface-var";
                
                return (
                  <article key={match.incident_id + index} className="card-organic overflow-hidden p-0 transition-all duration-200 hover:shadow-ambient-lg">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <strong className="font-display text-sm font-bold text-on-surface">
                            {match.date} &middot; <span className="text-xs uppercase tracking-wide">{match.event_type}</span>
                          </strong>
                          <p className="mt-0.5 text-xs text-on-surface-var line-clamp-2">
                            {match.description}
                          </p>
                        </div>
                        <div className={`font-display text-base font-black ${colorClass}`}>
                          {similarityPercent}%
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center justify-between border-t border-surface-container pt-3">
                        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-var">
                          Historical Recommendation
                        </span>
                        <div className="flex gap-3 text-xs font-semibold">
                          <span className="text-primary">{match.recommended_personnel} Staff</span>
                          <span className="text-tertiary">{match.recommended_barricades} Barricades</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        <div ref={deploymentRef} className="animate-fadeIn">
          <DeploymentPanel 
            recommendation={deploymentResult} 
            patrolRouteResult={patrolRouteResult}
            isGeneratingPatrol={isGeneratingPatrol}
            onGeneratePatrolRoute={onGeneratePatrolRoute}
            onClear={onClearDeployment}
            onClearPatrolRoute={onClearPatrolRoute}
          />
        </div>
      </div>
    </aside>
  );
}
