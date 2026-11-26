const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function cssColor(value: string, fallback: string): string {
  return HEX.test(value) ? value : fallback;
}

/** Brand colours for a nonce'd style element. Values are hex or the built-in fallback. */
export function brandStyleSheet(colors: { primary: string; accent: string; paper: string }): string {
  const lagoon = cssColor(colors.primary, "#0e3b37");
  const brass = cssColor(colors.accent, "#a86432");
  const paper = cssColor(colors.paper, "#f3ecdf");
  return `html.brand-colours{--lagoon:${lagoon};--brass:${brass};--paper:${paper}}`;
}
