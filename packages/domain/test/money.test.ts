import { describe, expect, it } from "vitest";
import {
  AMOUNT_ZERO,
  amountAbs,
  amountAdd,
  amountCompare,
  amountFromDecimal,
  amountSubtract,
  amountToDecimal,
  formatAmount
} from "../src/index";

describe("montants exacts (unités minoritaires)", () => {
  it("convertit les entiers et les décimaux sans perte flottante", () => {
    expect(amountFromDecimal("1180000")).toBe(118000000n);
    expect(amountFromDecimal(1180000)).toBe(118000000n);
    expect(amountFromDecimal("12.35")).toBe(1235n);
    expect(amountFromDecimal("0.1") + amountFromDecimal("0.2")).toBe(amountFromDecimal("0.3"));
  });

  it("arrondit au plus pair à deux décimales, comme MidpointRounding.ToEven", () => {
    expect(amountFromDecimal("2.125")).toBe(212n);
    expect(amountFromDecimal("2.135")).toBe(214n);
    expect(amountFromDecimal("2.1251")).toBe(213n);
    expect(amountFromDecimal("-2.135")).toBe(-214n);
  });

  it("rejette les saisies non monétaires", () => {
    expect(() => amountFromDecimal("abc")).toThrow(RangeError);
    expect(() => amountFromDecimal(Number.NaN)).toThrow(RangeError);
  });

  it("sérialise et reformate sans ambiguïté", () => {
    expect(amountToDecimal(118000000n)).toBe("1180000");
    expect(amountToDecimal(1235n)).toBe("12.35");
    expect(amountToDecimal(-1235n)).toBe("-12.35");
    const formatted = formatAmount(amountFromDecimal("2832000")).replace(/[\u202f\u00a0]/g, " ");
    expect(formatted).toBe("2 832 000 XOF");
  });

  it("additionne, soustrait et compare exactement", () => {
    expect(amountAdd(10n, 5n)).toBe(15n);
    expect(amountSubtract(AMOUNT_ZERO, 5n)).toBe(-5n);
    expect(amountAbs(-5n)).toBe(5n);
    expect(amountCompare(3n, 4n)).toBe(-1);
    expect(amountCompare(4n, 4n)).toBe(0);
  });
});
