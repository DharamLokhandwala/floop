/**
 * IDs that can be used directly in an unescaped `#id` CSS selector.
 *
 * This deliberately accepts the same conservative ASCII subset used by the
 * viewer today: a leading letter followed by letters, digits, underscores,
 * dots, or hyphens. Other valid HTML IDs require CSS escaping and therefore
 * fall back to the ancestry selector for now.
 */
export const USABLE_ELEMENT_ID_PATTERN = /^[a-zA-Z][\w.-]*$/;

export function selectorForElementId(id: string): string | null {
  return USABLE_ELEMENT_ID_PATTERN.test(id) ? `#${id}` : null;
}
