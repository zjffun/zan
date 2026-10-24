import { cleanChipAttrs, type ChipAttrs } from "./schema";

/**
 * The anchor chip under a click/tap target, in the editor or in rendered note
 * HTML (both carry `data-anchor-chip` and numeric `data-t` / `data-page` /
 * `data-ep`). Returns its validated attributes, or null if it is not a chip.
 */
export function chipFromElement(target: EventTarget | null): ChipAttrs | null {
  const element = target instanceof Element ? target.closest("[data-anchor-chip]") : null;
  if (!element) return null;
  const read = (name: string) => {
    const value = element.getAttribute(`data-${name}`);
    return value === null || value === "" ? undefined : Number(value);
  };
  return cleanChipAttrs({ t: read("t"), page: read("page"), ep: read("ep") });
}
