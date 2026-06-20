export default function TimelineScrubber({ minTime, maxTime, value, disabled, onChange }) {
  const hasRange = Number.isFinite(minTime) && Number.isFinite(maxTime);
  const display = hasRange && value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Loading dataset...";

  return (
    <section className="border-b border-console-line pb-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-console-text">Simulation Time</h2>
          <p className="text-xs text-console-muted">Active incidents are filtered by event duration.</p>
        </div>
        <span className="shrink-0 rounded bg-console-panel2 px-2 py-1 text-sm font-semibold text-sky-200">
          {display}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-xs text-console-muted">
        <span>{hasRange ? new Date(minTime).toLocaleDateString("en-IN") : "Start"}</span>
        <input
          type="range"
          min={hasRange ? minTime : 0}
          max={hasRange ? maxTime : 100}
          value={hasRange ? value : 100}
          disabled={disabled || !hasRange}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full"
        />
        <span>{hasRange ? new Date(maxTime).toLocaleDateString("en-IN") : "End"}</span>
      </div>
    </section>
  );
}
