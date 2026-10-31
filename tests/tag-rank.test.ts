import { describe, expect, it } from "vitest";
import { matchClass, pickerList, type PickerTag } from "@/lib/tag-rank";

let n = 0;
const tag = (name: string, extra: Partial<PickerTag> = {}): PickerTag => ({
  id: `id-${name}-${++n}`,
  slug: `slug${n}`,
  name,
  kind: null,
  post_count: 1,
  mine: false,
  ...extra,
});
/** a tag of mine keeps its id when it also shows up among what the directory found */
const same = (t: PickerTag, extra: Partial<PickerTag> = {}): PickerTag => ({ ...t, ...extra });
const names = (list: PickerTag[]) => list.map((t) => t.name);

describe("matchClass", () => {
  it("tells the same, a start and a part from each other, ignoring case", () => {
    expect(matchClass("Dune", "dune")).toBe(0);
    expect(matchClass("Dune Messiah", "dune")).toBe(1);
    expect(matchClass("The Dune", "dune")).toBe(2);
    expect(matchClass("Neuromancer", "dune")).toBeNull();
  });

  it("matches everything when nothing is typed", () => {
    expect(matchClass("anything", "  ")).toBe(2);
  });
});

describe("pickerList with nothing typed", () => {
  it("puts my recent tags first, in the order of their last use, then the busiest ones", () => {
    const recent = [tag("读书笔记", { mine: true, post_count: null }), tag("动漫", { mine: true, post_count: null })];
    const hot = [tag("游戏"), same(recent[1], { mine: false, post_count: 9 }), tag("书")];
    const list = pickerList({ query: "", recent, found: hot });
    expect(names(list)).toEqual(["读书笔记", "动漫", "游戏", "书"]);
    expect(list.map((t) => t.mine)).toEqual([true, true, false, false]);
  });

  it("does not list a tag twice, and fills up to the limit", () => {
    const recent = Array.from({ length: 10 }, (_, i) => tag(`我的${i}`, { mine: true, post_count: null }));
    const hot = Array.from({ length: 10 }, (_, i) => tag(`热${i}`));
    const list = pickerList({ query: "", recent, found: hot, limit: 8 });
    expect(list).toHaveLength(8);
    expect(names(list).slice(0, 6)).toEqual(["我的0", "我的1", "我的2", "我的3", "我的4", "我的5"]); // at most six of mine
    expect(names(list).slice(6)).toEqual(["热0", "热1"]);
  });

  it("is just the busiest ones for somebody who has not posted yet", () => {
    const hot = [tag("a"), tag("b")];
    expect(names(pickerList({ query: "", recent: [], found: hot }))).toEqual(["a", "b"]);
  });
});

describe("pickerList with something typed", () => {
  it("puts the same name first, then names that start with it, then the rest", () => {
    const found = [tag("所有的孤独摇滚"), tag("孤独摇滚！"), tag("孤独")];
    expect(names(pickerList({ query: "孤独", recent: [], found }))).toEqual(["孤独", "孤独摇滚！", "所有的孤独摇滚"]);
  });

  it("keeps the busiest first within a kind of match", () => {
    const found = [tag("dune a"), tag("dune b"), tag("dune c")];
    expect(names(pickerList({ query: "dune", recent: [], found }))).toEqual(["dune a", "dune b", "dune c"]);
  });

  it("puts mine before the others of the same kind of match, in the order of their last use", () => {
    const first = tag("动漫甲", { mine: true, post_count: null });
    const second = tag("动漫乙", { mine: true, post_count: null });
    const found = [tag("动漫丙"), same(second, { mine: false, post_count: 5 }), same(first, { mine: false, post_count: 3 })];
    const list = pickerList({ query: "动漫", recent: [first, second], found });
    expect(names(list)).toEqual(["动漫甲", "动漫乙", "动漫丙"]);
    expect(list.map((t) => t.mine)).toEqual([true, true, false]);
    expect(list[0].post_count).toBe(3); // the directory's count is kept
  });

  it("does not let mine jump over a better match", () => {
    const mine = tag("重看动漫", { mine: true, post_count: null }); // has it somewhere
    const found = [tag("动漫"), tag("动漫推荐")]; // the same, and a start
    expect(names(pickerList({ query: "动漫", recent: [mine], found }))).toEqual(["动漫", "动漫推荐", "重看动漫"]);
  });

  it("adds my own tags that fit but were not among the busiest the directory returned", () => {
    const mine = tag("冷门动漫", { mine: true, post_count: null });
    const found = [tag("动漫")];
    expect(names(pickerList({ query: "动漫", recent: [mine], found }))).toEqual(["动漫", "冷门动漫"]);
  });

  it("leaves out what does not match at all, and cuts at the limit", () => {
    const found = [tag("别的"), ...Array.from({ length: 12 }, (_, i) => tag(`动漫${i}`))];
    const list = pickerList({ query: "动漫", recent: [], found, limit: 8 });
    expect(list).toHaveLength(8);
    expect(names(list)).not.toContain("别的");
  });

  it("ignores case and surrounding spaces in what is typed", () => {
    const found = [tag("Dune"), tag("Dune Messiah")];
    expect(names(pickerList({ query: "  DUNE ", recent: [], found }))).toEqual(["Dune", "Dune Messiah"]);
  });
});
