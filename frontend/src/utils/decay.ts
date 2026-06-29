const MAX_AGE_HOURS = 24;

export function getPixelOpacity(createdAt: string): number {
  const age = (Date.now() - new Date(createdAt).getTime()) / 1000 / 60 / 60;
  if (age >= MAX_AGE_HOURS) return 0;
  if (age < MAX_AGE_HOURS / 2) return 1.0;
  const t = (age - MAX_AGE_HOURS / 2) / (MAX_AGE_HOURS / 2);
  return 1.0 - t;
}
