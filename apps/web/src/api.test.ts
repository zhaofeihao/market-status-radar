import { afterEach, describe, expect, it, vi } from "vitest";

describe("api client", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses same-origin API paths in production when no API base URL is configured", async () => {
    vi.stubEnv("PROD", true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ coin: "SOL", updatedAt: "2026-06-02T00:00:00.000Z", results: [] })
      }))
    );

    const { searchCoin } = await import("./api.js");

    await searchCoin("SOL");

    expect(fetch).toHaveBeenCalledWith("/api/search?coin=SOL");
  });
});
