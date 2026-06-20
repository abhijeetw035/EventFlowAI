const fieldClass = "w-full border border-console-line bg-console-bg px-3 py-2 text-sm text-console-text outline-none focus:border-sky-400";
const labelClass = "block space-y-1 text-xs font-medium text-console-muted";

export default function IncidentForm({ open, onToggle, form, onChange, onSubmit, mapPoint, submitting }) {
  return (
    <section className="border-b border-console-line py-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-console-text"
      >
        <span>Report New Incident</span>
        <span className="text-console-muted">{open ? "Close" : "Open"}</span>
      </button>

      {open && (
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          {mapPoint && (
            <p className="border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
              Map point staged: {mapPoint.lat.toFixed(5)}, {mapPoint.lon.toFixed(5)}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className={labelClass}>
              Latitude
              <input className={fieldClass} name="lat" value={form.lat} onChange={onChange} inputMode="decimal" />
            </label>
            <label className={labelClass}>
              Longitude
              <input className={fieldClass} name="lon" value={form.lon} onChange={onChange} inputMode="decimal" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
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
            <input className={fieldClass} name="event_cause" value={form.event_cause} onChange={onChange} />
          </label>
          <label className={labelClass}>
            Vehicle type
            <input className={fieldClass} name="veh_type" value={form.veh_type} onChange={onChange} />
          </label>

          <label className="flex items-center gap-2 text-sm text-console-text">
            <input
              type="checkbox"
              name="requires_road_closure"
              checked={form.requires_road_closure}
              onChange={onChange}
              className="h-4 w-4 accent-sky-500"
            />
            Requires road closure
          </label>

          <div className="grid grid-cols-3 gap-2">
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
            Incident description
            <textarea
              className={`${fieldClass} min-h-20 resize-y`}
              name="description"
              value={form.description}
              onChange={onChange}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-sky-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Run Diversion + Deployment"}
          </button>
        </form>
      )}
    </section>
  );
}
