/**
 * Channel-specific formatting for MAX messenger.
 * MAX does not render Markdown links correctly — use plain URLs only.
 */

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi;

/**
 * Converts Markdown links [text](url) to plain URL.
 * Leaves other text unchanged.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeMaxText(text = '') {
  let result = String(text);

  result = result.replace(MARKDOWN_LINK_RE, (_match, _label, url) => url.trim());

  // Collapse accidental duplicated URLs on adjacent lines
  result = result.replace(/(https?:\/\/\S+)\s*\n\s*\1/g, '$1');

  return result.trim();
}
