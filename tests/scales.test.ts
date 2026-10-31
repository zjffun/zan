import { describe, expect, it } from "vitest";
import { SCALES, SCALE_GROUPS, getScale, isIndexable } from "@/lib/scales";
import { RIGHTS_NOTICE, isUnconfirmed } from "@/lib/scales/rights";
import { bandFor, briefResult, cleanAnswers, resultToText, scoreScale } from "@/lib/scales/score";
import type { Scale } from "@/lib/scales/types";
import { validateScale } from "@/lib/scales/validate";

/** A small scale of our own, so that the rules are tested without depending on any real scale's wording. */
function makeScale(overrides: Partial<Scale> = {}): Scale {
  return {
    id: "demo",
    version: 1,
    group: "mood",
    title: "示例",
    short: "DEMO",
    summary: "示例",
    prompt: "提示",
    intro: ["说明"],
    options: [
      { value: 1, label: "一" },
      { value: 2, label: "二" },
      { value: 3, label: "三" },
      { value: 4, label: "四" },
    ],
    items: [
      { text: "甲", subscale: "a" },
      { text: "乙", subscale: "a", reverse: true },
      { text: "丙", subscale: "b" },
      { text: "丁", subscale: "b", alertAt: 4 },
    ],
    subscales: [
      {
        id: "a",
        title: "甲组",
        description: "d",
        bands: [
          { min: 2, max: 4, label: "低", text: "t", tone: "good" },
          { min: 5, max: 8, label: "高", text: "t", tone: "care" },
        ],
      },
      { id: "b", title: "乙组", description: "d", bands: [{ min: 2, max: 8, label: "全部", text: "t", tone: "good" }] },
    ],
    total: {
      bands: [
        { min: 4, max: 9, label: "低", text: "t", tone: "good" },
        { min: 10, max: 16, label: "高", text: "t", tone: "care" },
      ],
    },
    alertText: "注意",
    source: { credit: "c", terms: "t", rights: "open" },
    ...overrides,
  };
}

/**
 * Answers, each from 0 to 3, that add up to `score` when the scale is scored: filled from the first
 * item on, and a backwards item gets the mirrored answer.
 */
function answersFor(scale: Scale, score: number): number[] {
  let left = score;
  return scale.items.map((item) => {
    const gain = Math.min(3, left);
    left -= gain;
    return item.reverse ? 3 - gain : gain;
  });
}

describe("scoring", () => {
  it("sums the answers and finds the band", () => {
    const result = scoreScale(makeScale(), [4, 1, 2, 3]);
    // item 2 is reversed: 1 counts as 4
    expect(result.total).toMatchObject({ score: 4 + 4 + 2 + 3, min: 4, max: 16, mean: (4 + 4 + 2 + 3) / 4, band: { label: "高" } });
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("scores a reversed item by the option at the other end of the list", () => {
    const scale = makeScale();
    const score = (second: number) => scoreScale(scale, [1, second, 1, 1]).total?.score;
    expect([1, 2, 3, 4].map(score)).toEqual([7, 6, 5, 4]);
  });

  it("reverses by position, not by arithmetic, when the answers are not evenly spaced", () => {
    const scale = makeScale({
      options: [
        { value: 0, label: "a" },
        { value: 1, label: "b" },
        { value: 5, label: "c" },
      ],
      items: [{ text: "x", reverse: true }],
      subscales: undefined,
      total: { bands: [{ min: 0, max: 5, label: "all", text: "t", tone: "good" }] },
    });
    expect(scoreScale(scale, [0]).total?.score).toBe(5);
    expect(scoreScale(scale, [1]).total?.score).toBe(1);
    expect(scoreScale(scale, [5]).total?.score).toBe(0);
  });

  it("scores sub-scales separately, and every item also counts in the total", () => {
    const result = scoreScale(makeScale(), [1, 1, 1, 1]);
    expect(result.subscales.map((line) => [line.id, line.score, line.band?.label])).toEqual([
      ["a", 1 + 4, "高"],
      ["b", 1 + 1, "全部"],
    ]);
    expect(result.total?.score).toBe(7);
  });

  it("multiplies every sum, and the possible range with it", () => {
    const result = scoreScale(makeScale({ multiplier: 2 }), [1, 4, 1, 1]);
    expect(result.total).toMatchObject({ score: 2 * (1 + 1 + 1 + 1), min: 8, max: 32 });
    expect(result.subscales[0]).toMatchObject({ score: 4, min: 4, max: 16 });
  });

  describe("missing answers", () => {
    it("gives no total, and names the items left", () => {
      const result = scoreScale(makeScale(), [1, null, 2, null]);
      expect(result).toMatchObject({ complete: false, answered: 2, count: 4, missing: [2, 4], total: null });
    });

    it("still scores a sub-scale whose items are all answered", () => {
      const result = scoreScale(makeScale(), [1, 2, null, 3]);
      expect(result.subscales.map((line) => line.id)).toEqual(["a"]);
    });

    it("treats an answer list that is too short, or not a list, as unanswered", () => {
      expect(scoreScale(makeScale(), [1]).missing).toEqual([2, 3, 4]);
      expect(scoreScale(makeScale(), "nonsense")).toMatchObject({ complete: false, answered: 0, total: null });
      expect(scoreScale(makeScale(), undefined).answered).toBe(0);
    });

    it("does not count a value that is not one of the answers", () => {
      expect(cleanAnswers(makeScale(), [0, 5, 2.5, "3", NaN, Infinity])).toEqual([null, null, null, null]);
      expect(cleanAnswers(makeScale(), [1, 2, 3, 4, 4, 4])).toEqual([1, 2, 3, 4]);
    });
  });

  describe("bands", () => {
    const bands = makeScale().total!.bands;

    it("includes both ends of a band", () => {
      expect([4, 9, 10, 16].map((score) => bandFor(bands, score)?.label)).toEqual(["低", "低", "高", "高"]);
    });

    it("is null outside every band", () => {
      expect(bandFor(bands, 3)).toBeNull();
      expect(bandFor(bands, 17)).toBeNull();
    });

    it("picks the band at the lowest and the highest possible score", () => {
      const scale = makeScale();
      expect(scoreScale(scale, [1, 4, 1, 1]).total).toMatchObject({ score: 4, band: { label: "低" } });
      expect(scoreScale(scale, [4, 1, 4, 4]).total).toMatchObject({ score: 16, band: { label: "高" } });
    });

    it("moves up exactly at the boundary", () => {
      const scale = makeScale();
      // item 2 counts backwards: answering 2 earns 3
      expect(scoreScale(scale, [3, 2, 2, 2]).total).toMatchObject({ score: 10, band: { label: "高" } });
      expect(scoreScale(scale, [3, 3, 2, 2]).total).toMatchObject({ score: 9, band: { label: "低" } });
    });
  });

  describe("alerts", () => {
    it("points out an item answered at or above its threshold", () => {
      expect(scoreScale(makeScale(), [1, 1, 1, 4]).alerts).toEqual([4]);
      expect(scoreScale(makeScale(), [1, 1, 1, 3]).alerts).toEqual([]);
    });

    it("does so even before the questionnaire is finished", () => {
      expect(scoreScale(makeScale(), [null, null, null, 4]).alerts).toEqual([4]);
    });

    it("is quiet for an item without a threshold", () => {
      expect(scoreScale(makeScale(), [4, 4, 4, 1]).alerts).toEqual([]);
    });
  });

  it("writes the scores as text to paste into a note", () => {
    const scale = makeScale();
    expect(resultToText(scale, scoreScale(scale, [1, 4, 1, 1]), "2026年10月31日")).toBe(
      ["示例（DEMO）· 2026年10月31日", "总分：4 / 16（低）", "甲组：2 / 8（低）", "乙组：2 / 8（全部）"].join("\n"),
    );
  });
});

describe("briefResult", () => {
  it("says the total and its band", () => {
    const scale = makeScale();
    expect(briefResult(scoreScale(scale, [1, 4, 1, 1]))).toBe("总分 4（低）");
  });

  it("names each part when there is no total", () => {
    const scale = makeScale({ total: undefined });
    expect(briefResult(scoreScale(scale, [1, 4, 1, 1]))).toBe("甲组 低 · 乙组 全部");
  });
});

describe("validateScale", () => {
  it("accepts a sound scale", () => {
    expect(validateScale(makeScale())).toEqual([]);
  });

  it("finds a gap between bands", () => {
    const scale = makeScale({
      total: {
        bands: [
          { min: 4, max: 8, label: "低", text: "t", tone: "good" },
          { min: 10, max: 16, label: "高", text: "t", tone: "care" },
        ],
      },
    });
    expect(validateScale(scale).join("\n")).toContain("首尾相接");
  });

  it("finds bands that stop short of the highest score or start above the lowest", () => {
    const short = makeScale({ total: { bands: [{ min: 4, max: 15, label: "全部", text: "t", tone: "good" }] } });
    expect(validateScale(short).join("\n")).toContain("要到最高分 16");
    const late = makeScale({ total: { bands: [{ min: 5, max: 16, label: "全部", text: "t", tone: "good" }] } });
    expect(validateScale(late).join("\n")).toContain("要从最低分 4 开始");
  });

  it("takes the multiplier into account when it checks the ends of the bands", () => {
    expect(validateScale(makeScale({ multiplier: 2 })).join("\n")).toContain("要到最高分 32");
  });

  it("finds an item that belongs to a sub-scale nobody defined", () => {
    const scale = makeScale({ items: [{ text: "甲", subscale: "zzz" }] });
    expect(validateScale(scale).join("\n")).toContain("不存在的分量表 zzz");
  });

  it("finds a sub-scale without items", () => {
    const scale = makeScale({ items: [{ text: "甲", subscale: "a" }, { text: "乙", subscale: "a" }, { text: "丙", subscale: "a" }, { text: "丁", subscale: "a" }] });
    expect(validateScale(scale).join("\n")).toContain("分量表 b 下没有题目");
  });

  it("finds answers that do not rise, a threshold that is no answer, and a missing alert text", () => {
    const options = [
      { value: 2, label: "二" },
      { value: 1, label: "一" },
    ];
    expect(validateScale(makeScale({ options })).join("\n")).toContain("从小到大");
    const items = [{ text: "甲", alertAt: 9 }];
    expect(validateScale(makeScale({ items, subscales: undefined })).join("\n")).toContain("alertAt 不是任何一个选项的分值");
    expect(validateScale(makeScale({ alertText: undefined })).join("\n")).toContain("没有 alertText");
  });

  it("finds a scale with nothing to show", () => {
    expect(validateScale(makeScale({ total: undefined, subscales: undefined })).join("\n")).toContain("没有结果可看");
  });

  it("finds a bad address", () => {
    expect(validateScale(makeScale({ id: "Has Space" })).join("\n")).toContain("id");
  });
});

describe("the scales on the site", () => {
  it("are all sound", () => {
    expect(SCALES.flatMap(validateScale)).toEqual([]);
  });

  it("have addresses of their own", () => {
    const ids = SCALES.map((scale) => scale.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const scale of SCALES) expect(getScale(scale.id)).toBe(scale);
    expect(getScale("nope")).toBeUndefined();
  });

  it("belong to a group that is listed", () => {
    const groups = SCALE_GROUPS.map((group) => group.id);
    for (const scale of SCALES) expect(groups).toContain(scale.group);
  });

  it("show only Chinese to the reader", () => {
    for (const scale of SCALES) {
      const text = [scale.title, scale.summary, scale.prompt, ...scale.intro, ...scale.options.map((o) => o.label), ...scale.items.map((i) => i.text)];
      for (const line of text) expect(line).toMatch(/[一-鿿]/);
    }
  });
});

describe("rights", () => {
  const unconfirmed = makeScale({ source: { credit: "c", terms: "t", rights: "unconfirmed" } });

  it("keeps a scale whose rights are not cleared out of search engines and the site map", () => {
    expect(isIndexable(makeScale())).toBe(true);
    expect(isIndexable(unconfirmed)).toBe(false);
  });

  it("knows which scales need the notice", () => {
    expect(isUnconfirmed(makeScale())).toBe(false);
    expect(isUnconfirmed(unconfirmed)).toBe(true);
    expect(RIGHTS_NOTICE).toMatch(/版权/);
  });

  it("is a sound scale all the same", () => {
    expect(validateScale(unconfirmed)).toEqual([]);
  });

  it("is open for every scale on the site that says it is free to use (and the ones that are not say so)", () => {
    // a scale is only `open` when its terms say where the permission comes from
    for (const scale of SCALES.filter((candidate) => candidate.source.rights === "open")) {
      expect(scale.source.terms).toMatch(/公共领域|免费|无需许可|任何目的/);
    }
  });
});

describe("PHQ-9", () => {
  const phq9 = getScale("phq-9")!;

  it("runs from 0 to 27", () => {
    expect(scoreScale(phq9, answersFor(phq9, 0)).total).toMatchObject({ score: 0, max: 27, band: { label: "几乎没有" } });
    expect(scoreScale(phq9, answersFor(phq9, 27)).total).toMatchObject({ score: 27, band: { label: "重度" } });
  });

  it("changes band at 5, 10, 15 and 20", () => {
    const labels = [4, 5, 9, 10, 14, 15, 19, 20].map((score) => {
      const total = scoreScale(phq9, answersFor(phq9, score)).total;
      expect(total?.score).toBe(score);
      return total?.band?.label;
    });
    expect(labels).toEqual(["几乎没有", "轻度", "轻度", "中度", "中度", "中重度", "中重度", "重度"]);
  });

  it("flags any answer to the ninth question other than 'not at all'", () => {
    const answers = answersFor(phq9, 0);
    expect(scoreScale(phq9, answers).alerts).toEqual([]);
    answers[8] = 1;
    expect(scoreScale(phq9, answers).alerts).toEqual([9]);
  });

  it("flags it even when it is the only thing answered", () => {
    const answers = phq9.items.map((_, index) => (index === 8 ? 3 : null));
    expect(scoreScale(phq9, answers)).toMatchObject({ complete: false, total: null, alerts: [9] });
  });
});

describe("GAD-7", () => {
  const gad7 = getScale("gad-7")!;

  it("runs from 0 to 21 and changes band at 5, 10 and 15", () => {
    expect(scoreScale(gad7, answersFor(gad7, 21)).total).toMatchObject({ score: 21, max: 21, band: { label: "重度" } });
    const labels = [4, 5, 9, 10, 14, 15].map((score) => scoreScale(gad7, answersFor(gad7, score)).total?.band?.label);
    expect(labels).toEqual(["几乎没有", "轻度", "轻度", "中度", "中度", "重度"]);
  });
});

describe("Rosenberg self-esteem scale", () => {
  const rses = getScale("rosenberg-self-esteem")!;

  it("counts the five negative statements backwards", () => {
    expect(rses.items.map((item) => Boolean(item.reverse))).toEqual([false, true, false, false, true, true, false, true, true, false]);
  });

  it("gives 30 to the most positive answers and 0 to the most negative", () => {
    const best = rses.items.map((item) => (item.reverse ? 0 : 3));
    const worst = rses.items.map((item) => (item.reverse ? 3 : 0));
    expect(scoreScale(rses, best).total).toMatchObject({ score: 30, band: { label: "偏高" } });
    expect(scoreScale(rses, worst).total).toMatchObject({ score: 0, band: { label: "偏低" } });
  });

  it("gives the same score to 'agree' on a positive and 'disagree' on a negative statement", () => {
    const middle = rses.items.map((item) => (item.reverse ? 1 : 2));
    expect(scoreScale(rses, middle).total?.score).toBe(20);
  });

  it("calls 14 low, 15 and 25 normal, and 26 high", () => {
    const at = (score: number) => scoreScale(rses, answersFor(rses, score)).total;
    expect([14, 15, 25, 26].map((score) => [at(score)?.score, at(score)?.band?.label])).toEqual([
      [14, "偏低"],
      [15, "正常范围"],
      [25, "正常范围"],
      [26, "偏高"],
    ]);
  });
});

describe("SCS-SF", () => {
  const scs = getScale("scs-sf")!;
  const answers = (fill: (item: Scale["items"][number]) => number) => scs.items.map(fill);

  it("counts the six negatively worded items backwards, as Neff's scoring key says", () => {
    // self-judgment 11 and 12, isolation 4 and 8, over-identification 1 and 9
    expect(scs.items.flatMap((item, index) => (item.reverse ? [index + 1] : []))).toEqual([1, 4, 8, 9, 11, 12]);
  });

  it("has twelve items, answered from 1 to 5, and no sub-scales (two items each are not reliable)", () => {
    expect(scs.items).toHaveLength(12);
    expect(scs.options.map((option) => option.value)).toEqual([1, 2, 3, 4, 5]);
    expect(scs.subscales).toBeUndefined();
  });

  it("runs from 12 to 60: the kindest answers on every item give the top", () => {
    const kind = answers((item) => (item.reverse ? 1 : 5));
    const harsh = answers((item) => (item.reverse ? 5 : 1));
    expect(scoreScale(scs, kind).total).toMatchObject({ score: 60, min: 12, max: 60, mean: 5, band: { label: "偏高" } });
    expect(scoreScale(scs, harsh).total).toMatchObject({ score: 12, mean: 1, band: { label: "偏低" } });
  });

  it("agrees with Neff's cut-offs on the average: below 2.5 is low, up to 3.5 moderate, above 3.5 high", () => {
    // all answers 3 (the middle) average 3.0; moving one item at a time moves the sum by one
    const sumOf = (target: number) => {
      let left = target - 12; // every item counted as 1 to begin with
      return answers((item) => {
        const gain = Math.min(4, left);
        left -= gain;
        return item.reverse ? 5 - gain : 1 + gain;
      });
    };
    const at = (sum: number) => scoreScale(scs, sumOf(sum)).total;
    expect([29, 30, 42, 43].map((sum) => [at(sum)?.score, at(sum)?.band?.label])).toEqual([
      [29, "偏低"],
      [30, "中等"],
      [42, "中等"],
      [43, "偏高"],
    ]);
    // the averages on either side of the cut-offs
    expect(at(29)!.mean).toBeLessThan(2.5);
    expect(at(30)!.mean).toBeGreaterThanOrEqual(2.5);
    expect(at(42)!.mean).toBeLessThanOrEqual(3.5);
    expect(at(43)!.mean).toBeGreaterThan(3.5);
  });

  it("tells the average per item next to the sum when copied", () => {
    const result = scoreScale(scs, answers(() => 3));
    expect(result.total?.score).toBe(3 * 6 + 3 * 6);
    expect(resultToText(scs, result, "2026年10月31日")).toBe("自我关怀量表（简版）（SCS-SF）· 2026年10月31日\n总分：36 / 60（中等） · 平均每题 3.00");
  });
});

describe("DASS-21", () => {
  const dass = getScale("dass-21")!;
  const lineOf = (result: ReturnType<typeof scoreScale>, id: string) => result.subscales.find((line) => line.id === id);

  it("has seven items in each of its three parts and no total", () => {
    for (const id of ["depression", "anxiety", "stress"]) expect(dass.items.filter((item) => item.subscale === id)).toHaveLength(7);
    expect(scoreScale(dass, dass.items.map(() => 1)).total).toBeNull();
  });

  it("puts the items in the parts of the manual", () => {
    const numbers = (id: string) => dass.items.flatMap((item, index) => (item.subscale === id ? [index + 1] : []));
    expect(numbers("depression")).toEqual([3, 5, 10, 13, 16, 17, 21]);
    expect(numbers("anxiety")).toEqual([2, 4, 7, 9, 15, 19, 20]);
    expect(numbers("stress")).toEqual([1, 6, 8, 11, 12, 14, 18]);
  });

  it("doubles the sums, so the top of each part is 42", () => {
    const result = scoreScale(dass, dass.items.map(() => 3));
    expect(result.subscales.map((line) => [line.score, line.max, line.band?.label])).toEqual([
      [42, 42, "极重度"],
      [42, 42, "极重度"],
      [42, 42, "极重度"],
    ]);
  });

  it("changes band at the manual's cut-offs", () => {
    const bandsAt = (id: string, scores: number[]) =>
      scores.map((score) => {
        // the sum is doubled, so the part's answers add up to half of the score
        let left = score / 2;
        const answers = dass.items.map((item) => {
          if (item.subscale !== id) return 0;
          const gain = Math.min(3, left);
          left -= gain;
          return gain;
        });
        const line = lineOf(scoreScale(dass, answers), id);
        expect(line?.score).toBe(score);
        return line?.band?.label;
      });
    expect(bandsAt("depression", [8, 10, 12, 14, 20, 22, 26, 28])).toEqual(["正常", "轻度", "轻度", "中度", "中度", "重度", "重度", "极重度"]);
    expect(bandsAt("anxiety", [6, 8, 10, 14, 16, 18, 20])).toEqual(["正常", "轻度", "中度", "中度", "重度", "重度", "极重度"]);
    expect(bandsAt("stress", [14, 16, 18, 20, 26, 32, 34])).toEqual(["正常", "轻度", "轻度", "中度", "重度", "重度", "极重度"]);
  });

  it("scores a part once its own seven items are answered", () => {
    const answers = dass.items.map((item) => (item.subscale === "anxiety" ? 2 : null));
    const result = scoreScale(dass, answers);
    expect(result.complete).toBe(false);
    expect(result.subscales.map((line) => [line.id, line.score])).toEqual([["anxiety", 28]]);
  });
});
