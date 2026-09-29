/**
 * Formats any user, instructor, student, or admin name to ensure:
 * 1. It ALWAYS starts with a capital letter (and every word/part is properly capitalized).
 * 2. Any emojis or pictorial symbols are completely stripped out.
 * 3. Gracefully formats email handles if full_name is absent (e.g. "modestanwaije1@gmail.com" -> "Modestanwaije1").
 */
export const formatCapitalizedName = (nameOrEmail?: string | null, fallback: string = 'User'): string => {
  if (!nameOrEmail) return fallback;

  // Remove all emojis, pictorial symbols, variation selectors, and decorative unicode symbols
  let clean = nameOrEmail
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}]/gu, '')
    .trim();

  if (!clean) return fallback;

  // Extract raw username if email is provided
  if (clean.includes('@')) {
    clean = clean.split('@')[0];
  }

  // Capitalize each word / name part
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return fallback;

  return parts
    .map(part => {
      if (!part) return '';
      // If the word was entered in ALL-CAPS (e.g. "JOHN"), title-case it nicely
      const isAllUpper = part === part.toUpperCase() && part.length > 2;
      const normalized = isAllUpper ? part.toLowerCase() : part;
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(' ');
};

/**
 * Sanitizes input in real-time to strip emojis and capitalize words.
 */
export const sanitizeCapitalizedInput = (val: string): string => {
  if (!val) return '';
  const noEmoji = val.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}]/gu, '');
  return noEmoji.replace(/\b\w/g, c => c.toUpperCase());
};

