import { describe, expect, it } from "vitest";
import { createBinanceSignedQuery, createBybitAuthHeaders, createOkxAuthHeaders } from "../src/signing.js";

describe("signing helpers", () => {
  it("creates Binance HMAC SHA256 signed query strings", () => {
    expect(createBinanceSignedQuery({ timestamp: "1" }, "secret")).toBe(
      "timestamp=1&signature=c402d7b980cc9eabd875601df69f390fe7790d9ca1e140a3f62ec5f5d161e797"
    );
  });

  it("creates OKX private request headers", () => {
    expect(
      createOkxAuthHeaders({
        apiKey: "key",
        apiSecret: "secret",
        passphrase: "pass",
        method: "GET",
        requestPath: "/api/v5/asset/currencies?ccy=SOL",
        timestamp: "2020-01-01T00:00:00.000Z"
      })
    ).toEqual({
      "OK-ACCESS-KEY": "key",
      "OK-ACCESS-SIGN": "EObWyf1oJaDqPXYP90xzROdTV2/AZH1Un9mWDPVkWwg=",
      "OK-ACCESS-TIMESTAMP": "2020-01-01T00:00:00.000Z",
      "OK-ACCESS-PASSPHRASE": "pass"
    });
  });

  it("creates Bybit V5 private request headers", () => {
    expect(
      createBybitAuthHeaders({
        apiKey: "key",
        apiSecret: "secret",
        queryString: "coin=SOL",
        timestamp: "1700000000000",
        recvWindow: "5000"
      })
    ).toEqual({
      "X-BAPI-API-KEY": "key",
      "X-BAPI-TIMESTAMP": "1700000000000",
      "X-BAPI-RECV-WINDOW": "5000",
      "X-BAPI-SIGN": "542eccca77bfdd38cf5e727d2ffc5e1685fb7d9e5a549ba3d5801d50c9fbdff2"
    });
  });
});
