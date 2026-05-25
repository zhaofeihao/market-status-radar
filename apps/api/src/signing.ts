import { createHmac } from "node:crypto";

function hmacSha256Hex(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function hmacSha256Base64(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message).digest("base64");
}

export function createBinanceSignedQuery(params: Record<string, string>, apiSecret: string): string {
  const query = new URLSearchParams(params).toString();
  const signature = hmacSha256Hex(query, apiSecret);
  return `${query}&signature=${signature}`;
}

export interface OkxAuthInput {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  method: "GET" | "POST";
  requestPath: string;
  timestamp: string;
  body?: string;
}

export function createOkxAuthHeaders(input: OkxAuthInput): Record<string, string> {
  const body = input.body ?? "";
  return {
    "OK-ACCESS-KEY": input.apiKey,
    "OK-ACCESS-SIGN": hmacSha256Base64(`${input.timestamp}${input.method}${input.requestPath}${body}`, input.apiSecret),
    "OK-ACCESS-TIMESTAMP": input.timestamp,
    "OK-ACCESS-PASSPHRASE": input.passphrase
  };
}

export interface BybitAuthInput {
  apiKey: string;
  apiSecret: string;
  queryString: string;
  timestamp: string;
  recvWindow: string;
}

export function createBybitAuthHeaders(input: BybitAuthInput): Record<string, string> {
  return {
    "X-BAPI-API-KEY": input.apiKey,
    "X-BAPI-TIMESTAMP": input.timestamp,
    "X-BAPI-RECV-WINDOW": input.recvWindow,
    "X-BAPI-SIGN": hmacSha256Hex(`${input.timestamp}${input.apiKey}${input.recvWindow}${input.queryString}`, input.apiSecret)
  };
}
