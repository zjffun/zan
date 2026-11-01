/**
 * A key press that belongs to an input method and not to the page: the Enter that turns pinyin into
 * characters, the Backspace that shortens it. Browsers say so with `isComposing`; Safari ends the
 * composition before it reports the key, and marks the key with the code 229 instead.
 */
export function isImeKey(event: { isComposing?: boolean; keyCode?: number }): boolean {
  return event.isComposing === true || event.keyCode === 229;
}
