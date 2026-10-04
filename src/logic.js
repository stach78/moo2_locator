// Galaxy proportions (width : height) used to turn normalised clicks into distances.
// Distances are expressed as a fraction of the galaxy width.
export const ASPECT_W = 4;
export const ASPECT_H = 3;

export const CLOSE_LIMIT = 1 / 3;
export const MEDIUM_LIMIT = 2 / 3;

export function isValidPoint(p) {
  return (
    p != null &&
    typeof p.x === "number" &&
    typeof p.y === "number" &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= 0 && p.x <= 1 &&
    p.y >= 0 && p.y <= 1
  );
}

// a and b have x, y in [0, 1] relative to the galaxy rectangle.
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = (a.y - b.y) * (ASPECT_H / ASPECT_W);
  return Math.hypot(dx, dy);
}

export function band(a, b) {
  const d = distance(a, b);
  if (d < CLOSE_LIMIT) return "close";
  if (d < MEDIUM_LIMIT) return "medium";
  return "far";
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
