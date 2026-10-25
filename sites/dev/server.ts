import "dotenv/config";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createHandler } from "../function/handler.ts";

const PORT = Number(process.env.SITES_DEV_PORT ?? 8000);

function storedKey(): string {
  try {
    const parsed = JSON.parse(
      readFileSync(new URL("../../data/settings.json", import.meta.url), "utf8"),
    ) as { mimoApiKey?: unknown };
    return typeof parsed.mimoApiKey === "string" ? parsed.mimoApiKey.trim() : "";
  } catch {
    return "";
  }
}

const handler = createHandler((name) => {
  if (name === "MIMO_API_KEY") {
    return (process.env.MIMO_API_KEY ?? "").trim() || storedKey();
  }
  return process.env[name] ?? "";
});

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(", "));
    }

    const method = request.method ?? "GET";
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : (Readable.toWeb(request) as unknown as ReadableStream<Uint8Array>);
    const init: RequestInit & { duplex?: "half" } = { method, headers };
    if (body) {
      init.body = body;
      init.duplex = "half";
    }

    const result = await handler(new Request(url, init));
    response.statusCode = result.status;
    result.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        error: {
          code: "DEV_SERVER_ERROR",
          message: "本地 Function 适配失败。",
        },
      }),
    );
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[sites-dev] function listening on http://127.0.0.1:${PORT}`);
});
