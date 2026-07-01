/**
 * Phase 5E — user-facing error sanitisation (PURE). Server actions surface a failed operation's message
 * to the UI; this maps an error to a SAFE French message so no technical detail (Prisma internals, SQL,
 * stack frames, file paths, connection errors) can leak to the user. Our services throw clean French
 * validation messages — those pass through; anything that looks technical (or is empty / very long)
 * collapses to a generic fallback. Server-side logs still hold the full error; only the UI text is safe.
 */

const GENERIC_FR = "Une erreur inattendue s'est produite. Veuillez réessayer.";

/** Patterns that mark a message as technical / potentially leaky — never shown verbatim to a user. */
const LEAKY = /prisma|Invalid `|node_modules|\/Users\/|\bP\d{4}\b|\n\s*at |SELECT |INSERT |UPDATE |DELETE |PANIC|ECONN|ETIMEDOUT|getaddrinfo|password|secret|token|\bstack\b/i;

/** A safe, user-facing message for `error`. Clean validation messages pass through; technical ones don't. */
export function userFacingMessage(error: unknown, fallback: string = GENERIC_FR): string {
  if (error instanceof Error) {
    const message = (error.message ?? "").trim();
    if (!message || message.length > 300 || LEAKY.test(message)) return fallback;
    return message;
  }
  return fallback;
}
