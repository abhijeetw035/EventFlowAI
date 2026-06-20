export default function TimelineScrubber({ minTime, maxTime, value, disabled, onChange }) {
  const hasRange = Number.isFinite(minTime) && Number.isFinite(maxTime);
  const display = hasRange && value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Loading dataset...";

  return (
    <section className="card-organic p-6 animate-fadeIn">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-on-surface">Simulation Time</h2>
          <p className="mt-1 text-xs text-on-surface-var">Active incidents are filtered by event duration.</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-container px-3.5 py-1.5 font-display text-xs font-bold text-primary-on-cont">
          {display}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-on-surface-var">
          {hasRange ? new Date(minTime).toLocaleDateString("en-IN") : "Start"}
        </span>
        <input
          type="range"
          min={hasRange ? minTime : 0}
          max={hasRange ? maxTime : 100}
          value={hasRange ? value : 100}
          disabled={disabled || !hasRange}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full"
        />
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-on-surface-var">
          {hasRange ? new Date(maxTime).toLocaleDateString("en-IN") : "End"}
        </span>
      </div>
    </section>
  );
}
