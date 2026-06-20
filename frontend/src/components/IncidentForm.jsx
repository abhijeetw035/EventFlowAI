const fieldClass =
  "w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all duration-200 placeholder:text-on-surface-var/50 focus:bg-surface-container-lowest focus:shadow-[0_0_0_1.5px_rgba(0,110,28,0.2)]";

const labelClass = "block space-y-2 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-on-surface-var";

export default function IncidentForm({ open, onToggle, form, onChange, onSubmit, mapPoint, submitting }) {
  return (
    <section className="card-organic overflow-hidden animate-fadeIn" style={{ animationDelay: "180ms" }}>
      <button
        type="button"
        onClick={onToggle}
        className="btn-press flex w-full items-center justify-between p-6 text-left transition-colors duration-200 hover:bg-surface-container-low/40"
      >
        <span className="font-display text-base font-bold text-on-surface">Report New Incident</span>
        <span className={`text-on-surface-var transition-transform duration-250 ${open ? "rotate-180" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </button>

      {open && (
        <form className="animate-slideDown space-y-4 px-6 pb-6" onSubmit={onSubmit}>
          {mapPoint && (
            <div className="flex items-center gap-2.5 rounded-xl bg-primary-container/30 p-3.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
              </span>
              <span className="text-xs font-semibold text-primary">
                {mapPoint.lat.toFixed(5)}, {mapPoint.lon.toFixed(5)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Latitude
              <input className={fieldClass} name="lat" value={form.lat} onChange={onChange} inputMode="decimal" placeholder="12.9716" />
            </label>
            <label className={labelClass}>
              Longitude
              <input className={fieldClass} name="lon" value={form.lon} onChange={onChange} inputMode="decimal" placeholder="77.5946" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Event type
              <select className={fieldClass} name="event_type" value={form.event_type} onChange={onChange}>
                <option value="unplanned">Unplanned</option>
                <option value="planned">Planned</option>
              </select>
            </label>
            <label className={labelClass}>
              Priority
              <select className={fieldClass} name="priority" value={form.priority} onChange={onChange}>
                <option value="unknown">Unknown</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>

          <label className={labelClass}>
            Incident cause
            <input className={fieldClass} name="event_cause" value={form.event_cause} onChange={onChange} placeholder="e.g. collision" />
          </label>
          <label className={labelClass}>
            Vehicle type
            <input className={fieldClass} name="veh_type" value={form.veh_type} onChange={onChange} placeholder="e.g. truck" />
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-container-low p-3.5 text-sm text-on-surface transition-colors hover:bg-surface-container">
            <input
              type="checkbox"
              name="requires_road_closure"
              checked={form.requires_road_closure}
              onChange={onChange}
              className="h-4.5 w-4.5 rounded"
            />
            Requires road closure
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className={labelClass}>
              Corridor
              <input className={fieldClass} name="corridor" value={form.corridor} onChange={onChange} />
            </label>
            <label className={labelClass}>
              Junction
              <input className={fieldClass} name="junction" value={form.junction} onChange={onChange} />
            </label>
            <label className={labelClass}>
              Zone
              <input className={fieldClass} name="zone" value={form.zone} onChange={onChange} />
            </label>
          </div>

          <label className={labelClass}>
            Description
            <textarea
              className={`${fieldClass} min-h-[80px] resize-y`}
              name="description"
              value={form.description}
              onChange={onChange}
              placeholder="Describe the incident…"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="btn-press w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-on-primary shadow-ambient transition-all duration-200 hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Processing…" : "Run Diversion + Deployment"}
          </button>
        </form>
      )}
    </section>
  );
}
