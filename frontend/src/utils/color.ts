import { MOOD_COLORS } from '../constants';

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: Number.parseInt(result[1], 16),
    g: Number.parseInt(result[2], 16),
    b: Number.parseInt(result[3], 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function colorToSliderValue(color: string): number {
  const { r, g } = hexToRgb(color);
  if (r === 0 && g === 255) return 0;
  if (r === 255 && g === 0) return 1;
  if (r < 255 && g >= r) return (r / 255) * 0.5;
  if (r >= g) return 0.5 + ((255 - g) / 255) * 0.5;
  return 0.5;
}

function sliderValueToColor(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  const { GOOD, OK, BAD } = MOOD_COLORS;
  if (clamped <= 0.5) return lerpColor(GOOD, OK, clamped * 2);
  return lerpColor(OK, BAD, (clamped - 0.5) * 2);
}

export function lerpColor(c1: string, c2: string, t: number): string {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

export function interpolateMood(value: number): string {
  const { GOOD, OK, BAD } = MOOD_COLORS;
  if (value <= 0.5) return lerpColor(GOOD, OK, value * 2);
  return lerpColor(OK, BAD, (value - 0.5) * 2);
}

export function classifyMood(color: string): { label: string; hex: string } {
  const v = colorToSliderValue(color);
  if (v < 0.33) return { label: 'Good', hex: MOOD_COLORS.GOOD };
  if (v < 0.66) return { label: 'Okay', hex: MOOD_COLORS.OK };
  return { label: 'Bad', hex: MOOD_COLORS.BAD };
}

export function averageColors(colors: string[]): string {
  if (colors.length === 0) return '#888888';
  let total = 0;
  for (const c of colors) total += colorToSliderValue(c);
  return sliderValueToColor(total / colors.length);
}
