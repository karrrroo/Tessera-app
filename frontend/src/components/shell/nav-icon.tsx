// Renders one of the design source's ICON path strings (tessera-data.js),
// 18x18 viewBox, currentColor, matching the design system's icon convention.
export function NavIcon({ d, size = 18, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" className={className}>
      <path d={d} />
    </svg>
  );
}
