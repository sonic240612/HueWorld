export function getPixelOpacity(createdAt: string, expiresAt?: string): number {
  if (!expiresAt) {
    const age = (Date.now() - new Date(createdAt).getTime()) / 1000 / 60 / 60;
    if (age >= 24) return 0;
    if (age < 12) return 1.0;
    return 1.0 - (age - 12) / 12;
  }
  const created = new Date(createdAt).getTime();
  const expires = new Date(expiresAt).getTime();
  const total = expires - created;
  const elapsed = Date.now() - created;
  if (elapsed >= total) return 0;
  if (elapsed < total / 2) return 1.0;
  return 1.0 - (elapsed - total / 2) / (total / 2);
}
