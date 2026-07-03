/**
 * Cameroon hospital constellation (Phase 6.3, direction « Réseau »). The eight regional
 * hospitals as nodes at their approximate geographic positions, linked to Bertoua (the
 * review flagship, emphasized). Decorative, server-rendered inline SVG — no dependency,
 * hidden from assistive tech (`aria-hidden`) and from narrow viewports by the caller.
 */
export function HeroConstellation({ className }: { className?: string }) {
  // Approximate map positions (viewBox 0..200): Maroua (far north), Garoua, Ngaoundéré,
  // Bamenda/Bafoussam (west), Buéa (southwest), Ebolowa (south), Bertoua (east, hub).
  const hub = { x: 128, y: 118 };
  const nodes = [
    { x: 96, y: 30 }, // Maroua
    { x: 88, y: 52 }, // Garoua
    { x: 98, y: 82 }, // Ngaoundéré
    { x: 52, y: 104 }, // Bamenda
    { x: 44, y: 116 }, // Bafoussam
    { x: 38, y: 146 }, // Buéa
    { x: 96, y: 170 }, // Ebolowa
  ];
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      aria-hidden
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.45">
        {nodes.map((n, i) => (
          <line key={i} x1={hub.x} y1={hub.y} x2={n.x} y2={n.y} />
        ))}
      </g>
      <g fill="currentColor" opacity="0.9">
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r="4" />
        ))}
      </g>
      <circle cx={hub.x} cy={hub.y} r="7" fill="var(--cm-green, currentColor)" />
      <circle
        cx={hub.x}
        cy={hub.y}
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
    </svg>
  );
}
