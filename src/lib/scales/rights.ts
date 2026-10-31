import type { Scale } from "./types";

/** Shown on every page of a scale whose rights nobody has cleared: the owner of the site can change the wording here. */
export const RIGHTS_NOTICE =
  "这份量表的版权属于原作者和出版方，本站没有取得公开发布的许可，目前只是站长个人试用，请不要转发或再次发布。";

export const isUnconfirmed = (scale: Scale) => scale.source.rights === "unconfirmed";
