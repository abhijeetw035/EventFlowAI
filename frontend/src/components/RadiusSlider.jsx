export default function RadiusSlider({ value, onChange }) {
  return (
    <section className="card-organic p-6 animate-fadeIn" style={{ animationDelay: "60ms" }}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-on-surface">Search Radius</h2>
          <p className="mt-1 text-xs text-on-surface-var">Controls geospatial cluster radius sent to routing.</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-container px-3.5 py-1.5 font-display text-xs font-bold text-primary-on-cont">
          {value.toFixed(1)} km
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-on-surface-var">0.5 km</span>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.1"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full"
        />
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-on-surface-var">5.0 km</span>
      </div>
    </section>
  );
}
