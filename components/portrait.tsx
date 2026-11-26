const PALETTES = [
  ["#0e3b37", "#f3e6d4", "#c9843d"],
  ["#243044", "#f6efe4", "#d07a45"],
  ["#3d2c29", "#f3e7da", "#6f8f72"],
  ["#1d3a4c", "#f8f1e6", "#c46b4a"],
  ["#3a2f4a", "#f4ecdf", "#d9a441"],
  ["#12352f", "#efe2cf", "#8c4a3a"],
];

export function Portrait({ name, id }: { name: string; id: string }) {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [bg, paper, accent] = PALETTES[seed % PALETTES.length];
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <svg viewBox="0 0 320 400" role="img" aria-label={`Illustrated portrait for ${name}. Not a photograph of a real person.`}>
      <rect width="320" height="400" fill={bg} />
      <circle cx="250" cy="48" r="70" fill={accent} opacity="0.35" />
      <rect x="36" y="250" width="248" height="150" rx="80" fill={accent} />
      <circle cx="160" cy="158" r="62" fill={paper} />
      <text x="160" y="168" textAnchor="middle" fontSize="28" fontFamily="Georgia, serif" fill={bg}>
        {initials}
      </text>
    </svg>
  );
}
