/**
 * The books the scales and exercises come from, and what could be found about each one's content online.
 * This is a catalogue of where things are and under what terms: no question, exercise text or worksheet is
 * copied here. A scale that is on the site has its `scaleId` set and links to its own page.
 */

/**
 * What can be done with a resource:
 * - `open`: the owner says it may be used freely (teaching and the like included), so it could be built into the site
 * - `free`: the official site gives it away, and says nothing about passing it on: link to it, do not copy it
 * - `personal`: free, but for personal use only: it may not be copied or passed on
 * - `paid`: has to be bought, or asked for
 * - `none`: nothing public was found
 * - `unknown`: not looked up yet
 */
export type Availability = "open" | "free" | "personal" | "paid" | "none" | "unknown";

export interface ResourceLink {
  label: string;
  url: string;
}

export interface BookResource {
  name: string;
  kind: "scale" | "exercise";
  availability: Availability;
  /** what was found, in a sentence or two, including the terms as far as they could be read */
  note: string;
  links?: ResourceLink[];
  /** the id of the scale on this site, when it is there (see src/lib/scales) */
  scaleId?: string;
}

export interface Book {
  id: string;
  /** the Chinese title the reader knows it by */
  title: string;
  /** the original title, when known */
  original?: string;
  author?: string;
  /** true while it is a guess which book the Chinese title means */
  guessed?: boolean;
  stage: string;
  /** a word on what is not clear about the book itself */
  note?: string;
  resources: BookResource[];
}

export interface BookStage {
  id: string;
  title: string;
}
