export default function RadiusSlider({ value, onChange }) {
  return (
    <section className="border-b border-console-line py-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-console-text">Diversion Search Radius</h2>
          <p className="text-xs text-console-muted">Controls geospatial cluster radius sent to routing.</p>
        </div>
        <span className="rounded bg-console-panel2 px-2 py-1 text-sm font-semibold text-sky-200">
          {value.toFixed(1)} km
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-xs text-console-muted">
        <span>0.5 km</span>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.1"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full"
        />
        <span>5.0 km</span>
      </div>
    </section>
  );
}
