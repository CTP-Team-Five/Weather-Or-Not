// lib/generateSlug.ts

/**
 * Generate a URL-friendly slug from a canonical name
 * Format: {canonical-base}-{shortid}
 * Example: "Elk Mountain Ski Resort, PA" -> "elk-mountain-ski-resort-pa-x1ab"
 */
export function generateSlug(canonicalName: string): string {
  // Convert to lowercase and replace special chars with hyphens
  const base = canonicalName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Trim leading/trailing hyphens
    .replace(/-+/g, "-"); // Collapse multiple hyphens

  // Generate short random ID for uniqueness
  const shortId = generateShortId();

  return `${base}-${shortId}`;
}

/**
 * Generate a short random base62 ID (4-6 characters)
 */
function generateShortId(length: number = 4): string {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }

  return result;
}
