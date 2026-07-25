import { describe, expect, it } from "vitest";
import {
  opacityLevel,
  parseCareSteps,
  formatOccasion,
  occasionHint,
} from "@/lib/product-education";

describe("parseCareSteps", () => {
  it("splits multi-sentence care into scannable steps", () => {
    const steps = parseCareSteps(
      "Hand-wash or gentle machine wash cold. Do not bleach. Iron on medium (reverse side). Avoid high heat in dryer.",
    );
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0]).toMatch(/Hand-wash/i);
    expect(steps.some((s) => /bleach/i.test(s))).toBe(true);
  });

  it("returns a single step for short care notes", () => {
    const steps = parseCareSteps("Dry-clean only.");
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatch(/Dry-clean/i);
  });
});

describe("opacityLevel", () => {
  it("maps sheer and semi-sheer with lining tips", () => {
    expect(opacityLevel("Sheer").fill).toBe(1);
    expect(opacityLevel("Semi-sheer (lining recommended)").fill).toBe(2);
    expect(opacityLevel("Semi-sheer (lining recommended)").tip).toMatch(/lining/i);
  });

  it("maps opaque to full meter", () => {
    expect(opacityLevel("Opaque").fill).toBe(4);
  });
});

describe("occasions", () => {
  it("formats known tags and provides hints", () => {
    expect(formatOccasion("asoebi")).toBe("Asoebi / Owambe");
    expect(occasionHint("bridal")).toMatch(/White|ivory/i);
  });
});
