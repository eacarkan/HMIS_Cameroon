/**
 * Hand-rolled SVG micro-visuals (Phase 6.3 — charts rule: NO chart dependency).
 * Pure, presentational, server-renderable. Built in S2 so Part 2 dashboards reuse them.
 *  - `Sparkline`: a small trend line with an area fill and an emphasized endpoint.
 *  - `BarMini`: a compact bar row (e.g. revenue by payment method).
 * Values are plain numbers; scaling is internal. Callers provide the accessible label.
 */

export function Sparkline({
  values,
  width = 120,
  height = 36,
  className,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  label?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v: number) => height - pad - ((v - min) * (height - pad * 2)) / span;
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = `${pad},${height - pad} ${points.join(" ")} ${(width - pad).toFixed(1)},${height - pad}`;
  const last = values[values.length - 1];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <polygon points={area} fill="currentColor" opacity="0.12" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(values.length - 1)} cy={y(last)} r="2.4" fill="currentColor" />
    </svg>
  );
}

export function BarMini({
  items,
  className,
  label,
}: {
  items: { label: string; value: number }[];
  className?: string;
  label?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className={className} role={label ? "img" : undefined} aria-label={label}>
      <ul className="grid list-none gap-1.5">
        {items.map((item) => (
          <li key={item.label} className="grid grid-cols-[auto_1fr] items-center gap-2">
            <span className="text-muted-foreground w-24 truncate text-[11px]">
              {item.label}
            </span>
            <span className="bg-muted block h-2 overflow-hidden rounded-full">
              <span
                className="bg-primary block h-full rounded-full"
                style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
