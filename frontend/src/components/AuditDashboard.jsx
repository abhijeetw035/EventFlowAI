import { useCallback, useEffect, useRef, useState } from "react";
import { getAuditLogs, getAuditStats } from "../api/client.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_META = {
  diversion_query: {
    label: "Diversion Query",
    color: "#006e1c",
    bg: "#e8f5e9",
    border: "#a5d6a7",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    description: "Traffic cluster diversion calculations",
  },
  route_query: {
    label: "Route Query",
    color: "#0277bd",
    bg: "#e1f5fe",
    border: "#81d4fa",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    description: "Point-to-point route planning queries",
  },
  deployment_prediction: {
    label: "Deployment Prediction",
    color: "#6a1b9a",
    bg: "#f3e5f5",
    border: "#ce93d8",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    description: "Personnel & barricade ML recommendations",
  },
  plan_event_risk: {
    label: "Event Risk Planning",
    color: "#e65100",
    bg: "#fff3e0",
    border: "#ffcc80",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    description: "Planned event pre-risk analysis",
  },
};

const EVENT_TYPES = Object.keys(EVENT_META);

function formatTime(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function msLabel(ms) {
  if (!ms && ms !== 0) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function Badge({ color, bg, border, children }) {
  return (
    <span style={{ color, background: bg, border: `1px solid ${border}`, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
      {children}
    </span>
  );
}

function RiskBar({ value }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 75 ? "#d32f2f" : pct >= 50 ? "#e65100" : pct >= 25 ? "#f9a825" : "#2e7d32";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#e8eee2", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32 }}>{pct.toFixed(1)}</span>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ meta, count, avgMs, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "20px 22px",
        borderRadius: 20,
        background: isActive ? meta.color : "#fff",
        border: `2px solid ${isActive ? meta.color : meta.border}`,
        boxShadow: isActive ? `0 8px 24px ${meta.color}33` : "0 2px 12px rgba(23,29,22,0.06)",
        transition: "all 0.2s ease",
        textAlign: "left",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: isActive ? "rgba(255,255,255,0.2)" : meta.bg,
          color: isActive ? "#fff" : meta.color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {meta.icon}
        </div>
        <span style={{
          fontSize: 28, fontWeight: 800, lineHeight: 1,
          color: isActive ? "#fff" : meta.color,
        }}>{count ?? "—"}</span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#fff" : "#171d16", marginBottom: 2 }}>{meta.label}</div>
        <div style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.75)" : "#72796f" }}>{meta.description}</div>
      </div>
      {avgMs != null && (
        <div style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.85)" : "#72796f", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          avg {msLabel(avgMs)} / query
        </div>
      )}
    </button>
  );
}

// ─── Payload Detail View ─────────────────────────────────────────────────────
function PayloadDetail({ row }) {
  const meta = EVENT_META[row.event_type] || EVENT_META.diversion_query;
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;

  const renderDiversionQuery = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Field label="Target" value={`${payload.target_lat?.toFixed(5)}, ${payload.target_lon?.toFixed(5)}`} />
      <Field label="Cluster Size" value={payload.cluster_size} />
      <Field label="Diversions Found" value={payload.total_diversions_found} accent="#006e1c" />
      <Field label="Gridlock Count" value={payload.gridlock_count} accent={payload.gridlock_count > 0 ? "#d32f2f" : undefined} />
      <Field label="Response Time" value={msLabel(payload.response_time_ms)} />
      <Field label="Audit ID" value={payload.audit_id?.slice(0, 8) + "…"} mono />
      {payload.diversion_manifest?.length > 0 && (
        <div style={{ gridColumn: "1/-1" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#72796f", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Diversion Manifest</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {payload.diversion_manifest.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "#f0f6ea", borderRadius: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{m.from_road || "Unknown Road"}</span>
                <Badge color={m.status === "success" ? "#006e1c" : "#d32f2f"} bg={m.status === "success" ? "#e8f5e9" : "#ffebee"} border={m.status === "success" ? "#a5d6a7" : "#ef9a9a"}>{m.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderRouteQuery = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Field label="Start" value={`${payload.start_lat?.toFixed(5)}, ${payload.start_lon?.toFixed(5)}`} />
      <Field label="End" value={`${payload.end_lat?.toFixed(5)}, ${payload.end_lon?.toFixed(5)}`} />
      <Field label="Status" value={payload.route_status} accent={payload.route_status === "success" ? "#006e1c" : "#d32f2f"} />
      <Field label="Blocking Incidents" value={payload.blocking_incidents_count} accent={payload.blocking_incidents_count > 0 ? "#e65100" : undefined} />
      <Field label="Severed Edges" value={payload.severed_edges} />
      <Field label="Response Time" value={msLabel(payload.response_time_ms)} />
    </div>
  );

  const renderDeploymentPrediction = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Field label="Incident ID" value={payload.incident_id} mono />
      <Field label="Location" value={`${payload.lat?.toFixed(4)}, ${payload.lon?.toFixed(4)}`} />
      <Field label="Event Type" value={payload.event_type} />
      <Field label="Priority" value={payload.priority} accent={payload.priority === "high" ? "#d32f2f" : undefined} />
      <Field label="Personnel" value={payload.recommended_personnel} accent="#6a1b9a" />
      <Field label="Barricades" value={payload.recommended_barricades} accent="#6a1b9a" />
      <Field label="Tier" value={payload.deployment_tier} accent={payload.deployment_tier === "Critical" ? "#d32f2f" : payload.deployment_tier === "High" ? "#e65100" : undefined} />
      <Field label="Radius" value={payload.affected_radius_km ? `${payload.affected_radius_km} km` : "—"} />
      <Field label="Major Corridor" value={payload.is_major_corridor ? "Yes" : "No"} />
      <Field label="Response Time" value={msLabel(payload.response_time_ms)} />
      {payload.explanation?.length > 0 && (
        <div style={{ gridColumn: "1/-1" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#72796f", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Justification</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {payload.explanation.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: "#3a4539", padding: "8px 12px", background: "#f3e5f5", borderRadius: 8, lineHeight: 1.5 }}>
                {e}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderPlanEventRisk = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Field label="Event Type" value={payload.event_type} />
      <Field label="Location" value={`${payload.lat?.toFixed(4)}, ${payload.lon?.toFixed(4)}`} />
      <Field label="Planned Time" value={payload.planned_date_time} />
      <Field label="Duration" value={payload.expected_duration_hours ? `${payload.expected_duration_hours}h` : "—"} />
      <Field label="Personnel" value={payload.recommended_personnel} accent="#e65100" />
      <Field label="Barricades" value={payload.recommended_barricades} accent="#e65100" />
      <Field label="Tier" value={payload.deployment_tier} accent={payload.deployment_tier === "Critical" ? "#d32f2f" : undefined} />
      <Field label="Lead Time" value={payload.deployment_lead_time_hours ? `${payload.deployment_lead_time_hours}h` : "—"} />
      <Field label="Response Time" value={msLabel(payload.response_time_ms)} />
      <div style={{ gridColumn: "1/-1" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#72796f", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Risk Index</div>
        <RiskBar value={payload.pre_event_risk_index} />
      </div>
      <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <MiniStat label="Base Risk" value={payload.base_risk} />
        <MiniStat label="Freq Penalty" value={payload.freq_penalty} />
        <MiniStat label="Sev Penalty" value={payload.sev_penalty} />
        <MiniStat label="Time Penalty" value={payload.temporal_penalty} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: "16px 20px", background: "#fafef8", borderTop: `2px solid ${meta.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#72796f", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Audit Record — {formatTime(row.created_at)}
      </div>
      {row.event_type === "diversion_query" && renderDiversionQuery()}
      {row.event_type === "route_query" && renderRouteQuery()}
      {row.event_type === "deployment_prediction" && renderDeploymentPrediction()}
      {row.event_type === "plan_event_risk" && renderPlanEventRisk()}
    </div>
  );
}

function Field({ label, value, accent, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#72796f", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: accent || "#171d16", fontFamily: mono ? "monospace" : undefined }}>{value ?? "—"}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: "#fff3e0", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#e65100" }}>{value ?? 0}</div>
      <div style={{ fontSize: 10, color: "#72796f", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ─── Log Row ──────────────────────────────────────────────────────────────────
function LogRow({ row, expanded, onToggle }) {
  const meta = EVENT_META[row.event_type] || { label: row.event_type, color: "#72796f", bg: "#f5f5f5", border: "#e0e0e0", icon: null };
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;

  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${expanded ? meta.border : "#e8eee2"}`, background: "#fff", transition: "box-shadow 0.15s ease", boxShadow: expanded ? `0 4px 20px ${meta.color}22` : "0 1px 4px rgba(23,29,22,0.05)" }}>
      <button
        onClick={onToggle}
        style={{
          all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
          width: "100%", padding: "14px 18px", boxSizing: "border-box",
        }}
      >
        {/* Icon */}
        <div style={{ width: 32, height: 32, borderRadius: 10, background: meta.bg, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {meta.icon}
        </div>

        {/* Badge + ID */}
        <div style={{ flexShrink: 0 }}>
          <Badge color={meta.color} bg={meta.bg} border={meta.border}>{meta.label}</Badge>
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#72796f", flexShrink: 0 }}>{formatTime(row.created_at)}</span>
          <span style={{ fontSize: 12, color: "#3a4539", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {getRowSummary(row.event_type, payload)}
          </span>
        </div>

        {/* Response time pill */}
        {payload.response_time_ms != null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#72796f", background: "#f0f6ea", borderRadius: 8, padding: "3px 10px", flexShrink: 0 }}>
            {msLabel(payload.response_time_ms)}
          </span>
        )}

        {/* Chevron */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#72796f" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && <PayloadDetail row={row} />}
    </div>
  );
}

function getRowSummary(eventType, payload) {
  switch (eventType) {
    case "diversion_query":
      return `${payload.cluster_size} incidents · ${payload.total_diversions_found} diversion${payload.total_diversions_found !== 1 ? "s" : ""} found${payload.gridlock_count > 0 ? ` · ${payload.gridlock_count} gridlock` : ""}`;
    case "route_query":
      return `${payload.start_lat?.toFixed(3)},${payload.start_lon?.toFixed(3)} → ${payload.end_lat?.toFixed(3)},${payload.end_lon?.toFixed(3)} · ${payload.route_status}`;
    case "deployment_prediction":
      return `${payload.incident_id || "—"} · ${payload.recommended_personnel}👤 ${payload.recommended_barricades}🚧 · Tier: ${payload.deployment_tier}`;
    case "plan_event_risk":
      return `${payload.event_type} · Risk ${payload.pre_event_risk_index} · Lead time ${payload.deployment_lead_time_hours}h`;
    default:
      return eventType;
  }
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AuditDashboard() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [filter, setFilter] = useState(null); // null = all
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef(null);
  const PAGE_SIZE = 20;

  const fetchStats = useCallback(async () => {
    try {
      const s = await getAuditStats();
      setStats(s);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (f, p) => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ eventType: f, limit: PAGE_SIZE, offset: p * PAGE_SIZE });
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchLogs(filter, page);
  }, [filter, page, fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = setInterval(() => {
        fetchStats();
        fetchLogs(filter, page);
      }, 10000);
    }
    return () => clearInterval(refreshRef.current);
  }, [autoRefresh, filter, page, fetchStats, fetchLogs]);

  const totalLogs = stats?.total ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#f5fbef", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "#006e1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#171d16", letterSpacing: "-0.02em" }}>
              Audit Trail
            </h2>
            {totalLogs > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#006e1c", background: "#e8f5e9", borderRadius: 999, padding: "2px 10px" }}>
                {totalLogs} records
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#72796f" }}>
            Immutable operational log — every query, prediction & risk assessment recorded
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            style={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 10,
              background: autoRefresh ? "#e8f5e9" : "#fff",
              border: `1.5px solid ${autoRefresh ? "#a5d6a7" : "#e8eee2"}`,
              fontSize: 12, fontWeight: 600, color: autoRefresh ? "#006e1c" : "#72796f",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: autoRefresh ? "#006e1c" : "#ccc", display: "inline-block", ...(autoRefresh ? { animation: "pulse 1.5s infinite" } : {}) }} />
            {autoRefresh ? "Live" : "Paused"}
          </button>

          {/* Refresh button */}
          <button
            onClick={() => { fetchStats(); fetchLogs(filter, page); }}
            style={{
              all: "unset", cursor: "pointer", padding: "7px 14px", borderRadius: 10,
              background: "#fff", border: "1.5px solid #e8eee2",
              fontSize: 12, fontWeight: 600, color: "#3a4539",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ padding: "16px 28px", display: "flex", gap: 12, flexShrink: 0 }}>
        {EVENT_TYPES.map(et => (
          <StatCard
            key={et}
            meta={EVENT_META[et]}
            count={stats?.counts?.[et] ?? 0}
            avgMs={stats?.avg_response_ms?.[et]}
            isActive={filter === et}
            onClick={() => { setFilter(filter === et ? null : et); setPage(0); setExpandedId(null); }}
          />
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ padding: "0 28px 12px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#72796f" }}>Filter:</span>
        <button
          onClick={() => { setFilter(null); setPage(0); setExpandedId(null); }}
          style={{
            all: "unset", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 999,
            background: !filter ? "#171d16" : "#fff",
            color: !filter ? "#fff" : "#72796f",
            border: `1.5px solid ${!filter ? "#171d16" : "#e8eee2"}`,
          }}
        >All</button>
        {EVENT_TYPES.map(et => {
          const m = EVENT_META[et];
          return (
            <button key={et}
              onClick={() => { setFilter(filter === et ? null : et); setPage(0); setExpandedId(null); }}
              style={{
                all: "unset", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 999,
                background: filter === et ? m.color : "#fff",
                color: filter === et ? "#fff" : m.color,
                border: `1.5px solid ${filter === et ? m.color : m.border}`,
              }}
            >{m.label}</button>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#72796f" }}>
          {total} record{total !== 1 ? "s" : ""}{filter ? ` · ${EVENT_META[filter]?.label}` : ""}
        </span>
      </div>

      {/* ── Log List ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 16px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: 62, borderRadius: 14, background: "#e8eee2", animation: "shimmer 1.5s infinite" }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#72796f" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c8d5c2" strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No audit records yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Records appear here when queries are made from the map</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {logs.map(row => (
              <LogRow
                key={row.id}
                row={row}
                expanded={expandedId === row.id}
                onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
            <button
              disabled={page === 0}
              onClick={() => { setPage(p => p - 1); setExpandedId(null); }}
              style={{ all: "unset", cursor: page === 0 ? "default" : "pointer", padding: "6px 18px", borderRadius: 10, background: "#fff", border: "1.5px solid #e8eee2", fontSize: 13, fontWeight: 600, color: page === 0 ? "#c8d5c2" : "#171d16" }}
            >← Prev</button>
            <span style={{ padding: "6px 16px", fontSize: 13, color: "#72796f" }}>Page {page + 1} of {pages}</span>
            <button
              disabled={page >= pages - 1}
              onClick={() => { setPage(p => p + 1); setExpandedId(null); }}
              style={{ all: "unset", cursor: page >= pages - 1 ? "default" : "pointer", padding: "6px 18px", borderRadius: 10, background: "#fff", border: "1.5px solid #e8eee2", fontSize: 13, fontWeight: 600, color: page >= pages - 1 ? "#c8d5c2" : "#171d16" }}
            >Next →</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
