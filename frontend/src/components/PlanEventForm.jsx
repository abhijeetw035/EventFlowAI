const fieldClass =
  "w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all duration-200 placeholder:text-on-surface-var/50 focus:bg-surface-container-lowest focus:shadow-[0_0_0_1.5px_rgba(0,110,28,0.2)]";

const labelClass = "block space-y-2 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-on-surface-var";

export default function PlanEventForm({ open, onToggle, form, onChange, onSubmit, mapPoint, submitting }) {
  return (
    <section className="card-organic overflow-hidden animate-fadeIn" style={{ animationDelay: "240ms" }}>
      <button
        type="button"
        onClick={onToggle}
        className="btn-press flex w-full items-center justify-between p-6 text-left transition-colors duration-200 hover:bg-surface-container-low/40"
      >
        <span className="font-display text-base font-bold text-on-surface">Plan a New Event</span>
        <span className={`text-on-surface-var transition-transform duration-250 ${open ? "rotate-180" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </button>

      {open && (
        <form className="animate-slideDown space-y-4 px-6 pb-6" onSubmit={onSubmit}>
          {mapPoint && (
            <div className="flex items-center gap-2.5 rounded-xl bg-tertiary-container/30 p-3.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tertiary opacity-50"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-tertiary"></span>
              </span>
              <span className="text-xs font-semibold text-tertiary">
                {mapPoint.lat.toFixed(5)}, {mapPoint.lon.toFixed(5)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Latitude
              <input className={fieldClass} name="lat" value={form.lat} onChange={onChange} inputMode="decimal" placeholder="12.9716" required />
            </label>
            <label className={labelClass}>
              Longitude
              <input className={fieldClass} name="lon" value={form.lon} onChange={onChange} inputMode="decimal" placeholder="77.5946" required />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Event Type
              <select className={fieldClass} name="event_type" value={form.event_type} onChange={onChange}>
                <option value="festival">Festival</option>
                <option value="match">Sports Match</option>
                <option value="rally">Rally</option>
                <option value="marathon">Marathon</option>
                <option value="planned">Other Planned</option>
              </select>
            </label>
            <label className={labelClass}>
              Duration (Hours)
              <input type="number" step="0.5" className={fieldClass} name="expected_duration_hours" value={form.expected_duration_hours} onChange={onChange} placeholder="4" required />
            </label>
          </div>

          <label className={labelClass}>
            Planned Date & Time
            <input type="datetime-local" className={fieldClass} name="planned_date_time" value={form.planned_date_time} onChange={onChange} required />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className={labelClass}>
              Corridor
              <input className={fieldClass} name="corridor" value={form.corridor} onChange={onChange} placeholder="e.g. MG Road" />
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
              placeholder="Describe the planned event…"
              required
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="btn-press w-full rounded-xl bg-tertiary px-4 py-3.5 text-sm font-bold text-on-tertiary shadow-ambient transition-all duration-200 hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Analyzing Risk…" : "Calculate Risk & Lead Time"}
          </button>
        </form>
      )}
    </section>
  );
}
