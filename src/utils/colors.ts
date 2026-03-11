export interface CalendarColor {
  bg: string;
  text: string;
}

// Helper to convert HSL to HEX for html2canvas compatibility (avoids oklch issues)
export const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// Generates 36 distinct colors around the color wheel
export const generateColors = (): CalendarColor[] => {
  const colors: CalendarColor[] = [];
  for (let i = 0; i < 36; i++) {
    const hue = Math.floor(i * (360 / 36));
    // We store as HSL but will provide a way to get HEX
    colors.push({
      bg: `hsl(${hue}, 70%, 92%)`,
      text: `hsl(${hue}, 70%, 42%)`,
    });
  }
  return colors;
};

export const presetColors = generateColors();

// Helper to ensure a color string is safe for html2canvas
export const getSafeColor = (colorStr: string): string => {
  if (colorStr.startsWith('#')) return colorStr;
  if (colorStr.startsWith('hsl')) {
    const match = colorStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      return hslToHex(Number(match[1]), Number(match[2]), Number(match[3]));
    }
  }
  return colorStr; // Fallback
};
