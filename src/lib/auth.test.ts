import { describe, expect, it } from "vitest";
import { hashPassword } from "./auth";

describe("hashPassword", () => {
  it("produces a stable 64-character hex digest for the same input", async () => {
    const a = await hashPassword("secret");
    const b = await hashPassword("secret");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different digests for different inputs", async () => {
    const a = await hashPassword("secret");
    const b = await hashPassword("different");
    expect(a).not.toBe(b);
  });
});
