import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";
import * as net from "node:net";
import * as tls from "node:tls";
import { generateCACertificate } from "mockttp";
import { RequestRepository } from "../../src/daemon/storage.js";
import { createProxy } from "../../src/daemon/proxy.js";
import { createControlServer } from "../../src/daemon/control.js";
import { ControlClient } from "../../src/shared/control-client.js";
import { ensureProcsiDir, getProcsiPaths } from "../../src/shared/project.js";
import { createInterceptorLoader } from "../../src/daemon/interceptor-loader.js";
import { createInterceptorRunner } from "../../src/daemon/interceptor-runner.js";
import { createProcsiClient } from "../../src/daemon/procsi-client.js";

describe("interceptor integration", { timeout: 30_000 }, () => {
  let tempDir: string;
  let paths: ReturnType<typeof getProcsiPaths>;
  let storage: RequestRepository;
  let cleanup: (() => Promise<void>)[] = [];

  const STORAGE_SETTLE_MS = 100;
  const PROXY_REQUEST_TIMEOUT_MS = 10_000;
  const DEFAULT_HTTPS_PORT = 443;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "procsi-interceptor-test-"));
    ensureProcsiDir(tempDir);
    paths = getProcsiPaths(tempDir);

    const ca = await generateCACertificate({
      subject: { commonName: "procsi Test CA" },
    });
    fs.writeFileSync(paths.caKeyFile, ca.key);
    fs.writeFileSync(paths.caCertFile, ca.cert);

    storage = new RequestRepository(paths.databaseFile);
    cleanup = [];
  });

  afterEach(async () => {
    for (const fn of cleanup.reverse()) {
      await fn();
    }
    storage.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Spin up an upstream test server, load an interceptor from the given code,
   * and wire everything together through the proxy.
   */
  async function setupWithInterceptor(interceptorCode: string) {
    // Write the interceptor file
    fs.mkdirSync(paths.interceptorsDir, { recursive: true });
    const interceptorFile = path.join(paths.interceptorsDir, "test.ts");
    fs.writeFileSync(interceptorFile, interceptorCode);

    // Start a simple upstream HTTP server
    const testServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "hello from upstream" }));
    });
    await new Promise<void>((resolve) => testServer.listen(0, "127.0.0.1", resolve));
    const testPort = (testServer.address() as { port: number }).port;
    cleanup.push(() => {
      testServer.closeAllConnections();
      return new Promise((resolve) => testServer.close(() => resolve()));
    });

    // Load interceptors via jiti
    const procsiClient = createProcsiClient(storage);
    const loader = await createInterceptorLoader({
      interceptorsDir: paths.interceptorsDir,
      projectRoot: tempDir,
      logLevel: "silent",
    });
    cleanup.push(async () => loader.close());

    const runner = createInterceptorRunner({
      loader,
      procsiClient,
      projectRoot: tempDir,
      logLevel: "silent",
    });

    // Create session and proxy with the interceptor runner
    const session = storage.registerSession("test", process.pid);
    const proxy = await createProxy({
      caKeyPath: paths.caKeyFile,
      caCertPath: paths.caCertFile,
      storage,
      sessionId: session.id,
      interceptorRunner: runner,
    });
    cleanup.push(proxy.stop);

    return { proxy, session, loader, testPort };
  }

  /**
   * Make an HTTP request routed through the proxy.
   */
  function makeProxiedRequest(
    proxyPort: number,
    url: string,
    options?: { method?: string; body?: string; headers?: Record<string, string> }
  ): Promise<{ statusCode: number; body: string; headers: http.IncomingHttpHeaders }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: proxyPort,
          path: url,
          method: options?.method ?? "GET",
          headers: { Host: parsedUrl.host, Connection: "close", ...options?.headers },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk: string) => (body += chunk));
          res.on("end", () =>
            resolve({ statusCode: res.statusCode ?? 0, body, headers: res.headers })
          );
        }
      );

      req.setTimeout(PROXY_REQUEST_TIMEOUT_MS, () => {
        req.destroy(new Error(`Proxy request timed out after ${PROXY_REQUEST_TIMEOUT_MS}ms`));
      });
      req.on("error", reject);

      if (options?.body) req.write(options.body);
      req.end();
    });
  }

  function decodeChunkedBody(rawBody: string): string {
    let offset = 0;
    let decoded = "";

    while (offset < rawBody.length) {
      const sizeEnd = rawBody.indexOf("\r\n", offset);
      if (sizeEnd === -1) {
        throw new Error("Invalid chunked body: missing chunk size terminator");
      }

      const sizeHex = rawBody.slice(offset, sizeEnd).split(";", 1)[0]?.trim() ?? "";
      const chunkSize = Number.parseInt(sizeHex, 16);

      if (Number.isNaN(chunkSize) || chunkSize < 0) {
        throw new Error("Invalid chunked body: invalid chunk size");
      }

      offset = sizeEnd + 2;
      if (chunkSize === 0) {
        return decoded;
      }

      const chunk = rawBody.slice(offset, offset + chunkSize);
      if (chunk.length < chunkSize) {
        throw new Error("Invalid chunked body: incomplete chunk payload");
      }

      decoded += chunk;
      offset += chunkSize;

      if (rawBody.slice(offset, offset + 2) !== "\r\n") {
        throw new Error("Invalid chunked body: missing chunk terminator");
      }
      offset += 2;
    }

    return decoded;
  }

  function parseRawHttpResponse(rawResponse: string): {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  } {
    const headerBoundary = rawResponse.indexOf("\r\n\r\n");
    if (headerBoundary === -1) {
      throw new Error("Invalid HTTP response: missing header boundary");
    }

    const headerBlock = rawResponse.slice(0, headerBoundary);
    const bodyBlock = rawResponse.slice(headerBoundary + 4);

    const lines = headerBlock.split("\r\n");
    const statusLine = lines.shift();
    if (!statusLine) {
      throw new Error("Invalid HTTP response: missing status line");
    }

    const statusMatch = statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})\b/);
    if (!statusMatch || !statusMatch[1]) {
      throw new Error(`Invalid HTTP response status line: ${statusLine}`);
    }

    const headers: Record<string, string> = {};
    for (const line of lines) {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        continue;
      }

      const name = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      headers[name] = value;
    }

    const transferEncoding = headers["transfer-encoding"]?.toLowerCase() ?? "";
    const body = transferEncoding.includes("chunked") ? decodeChunkedBody(bodyBlock) : bodyBlock;

    return {
      statusCode: Number.parseInt(statusMatch[1], 10),
      headers,
      body,
    };
  }

  /**
   * Make an HTTPS request through an HTTP proxy by explicitly opening a CONNECT tunnel,
   * then speaking TLS over that tunnel.
   */
  function makeProxiedHttpsRequest(
    proxyPort: number,
    url: string,
    caCertPem: string
  ): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "https:") {
        reject(new Error(`Expected https URL, got ${parsedUrl.protocol}`));
        return;
      }

      const targetPort = parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : DEFAULT_HTTPS_PORT;
      const targetAuthority = `${parsedUrl.hostname}:${targetPort}`;
      const requestPath = `${parsedUrl.pathname}${parsedUrl.search}`;

      const socket = net.connect(proxyPort, "127.0.0.1");
      let settled = false;

      const finish = (result: {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        socket.destroy();
        reject(err);
      };

      const timeoutId = setTimeout(() => {
        fail(new Error(`HTTPS proxy request timed out after ${PROXY_REQUEST_TIMEOUT_MS}ms`));
      }, PROXY_REQUEST_TIMEOUT_MS);

      socket.once("error", (err) => fail(err instanceof Error ? err : new Error(String(err))));

      socket.once("connect", () => {
        socket.write(
          [
            `CONNECT ${targetAuthority} HTTP/1.1`,
            `Host: ${targetAuthority}`,
            "Proxy-Connection: Keep-Alive",
            "",
            "",
          ].join("\r\n")
        );
      });

      let connectResponse = "";
      const onConnectData = (chunk: Buffer) => {
        connectResponse += chunk.toString("utf8");

        if (!connectResponse.includes("\r\n\r\n")) {
          return;
        }

        socket.off("data", onConnectData);

        const connectHead = connectResponse.split("\r\n\r\n", 1)[0] ?? "";
        const connectStatusMatch = connectHead.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})\b/m);
        const connectStatus = connectStatusMatch?.[1]
          ? Number.parseInt(connectStatusMatch[1], 10)
          : 0;

        if (connectStatus !== 200) {
          fail(new Error(`CONNECT tunnel failed with status ${connectStatus}`));
          return;
        }

        const tlsSocket = tls.connect({
          socket,
          servername: parsedUrl.hostname,
          ca: caCertPem,
          rejectUnauthorized: true,
        });

        tlsSocket.once("error", (err) => fail(err instanceof Error ? err : new Error(String(err))));

        tlsSocket.once("secureConnect", () => {
          tlsSocket.write(
            [
              `GET ${requestPath} HTTP/1.1`,
              `Host: ${parsedUrl.host}`,
              "Connection: close",
              "",
              "",
            ].join("\r\n")
          );
        });

        let rawResponse = "";
        tlsSocket.on("data", (chunk) => {
          rawResponse += chunk.toString("utf8");
        });

        tlsSocket.on("end", () => {
          try {
            finish(parseRawHttpResponse(rawResponse));
          } catch (err: unknown) {
            fail(err instanceof Error ? err : new Error(String(err)));
          }
        });
      };

      socket.on("data", onConnectData);
    });
  }

  describe("proxy with interceptors", () => {
    it("returns a mocked response when the interceptor matches and does not call forward()", async () => {
      const mockInterceptorCode = `
export default {
  name: "test-mock",
  match: (req) => req.path === "/api/test",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mocked: true }),
  }),
};
`;

      const { proxy, testPort } = await setupWithInterceptor(mockInterceptorCode);

      const response = await makeProxiedRequest(
        proxy.port,
        `http://127.0.0.1:${testPort}/api/test`
      );

      expect(response.statusCode).toBe(200);
      const parsed = JSON.parse(response.body);
      expect(parsed).toEqual({ mocked: true });

      // Allow async storage writes to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const requests = storage.listRequests();
      expect(requests).toHaveLength(1);

      const captured = requests[0];
      expect(captured?.interceptionType).toBe("mocked");
      expect(captured?.interceptedBy).toBe("test-mock");
      expect(captured?.responseStatus).toBe(200);
    });

    it("modifies the upstream response when the interceptor calls forward()", async () => {
      const modifyInterceptorCode = `
export default {
  name: "test-modify",
  match: (req) => req.path === "/api/test",
  handler: async (ctx) => {
    const response = await ctx.forward();
    return {
      ...response,
      headers: { ...response.headers, "x-intercepted": "true" },
    };
  },
};
`;

      const { proxy, testPort } = await setupWithInterceptor(modifyInterceptorCode);

      const response = await makeProxiedRequest(
        proxy.port,
        `http://127.0.0.1:${testPort}/api/test`
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-intercepted"]).toBe("true");

      // Upstream response should still come through
      const parsed = JSON.parse(response.body);
      expect(parsed).toEqual({ message: "hello from upstream" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const requests = storage.listRequests();
      expect(requests).toHaveLength(1);

      const captured = requests[0];
      expect(captured?.interceptionType).toBe("modified");
      expect(captured?.interceptedBy).toBe("test-modify");
    });

    it("records interceptor name but not modified marker for observe-only forward", async () => {
      const observeInterceptorCode = `
export default {
  name: "test-observe",
  match: (req) => req.path === "/api/test",
  handler: async (ctx) => {
    await ctx.forward();
    return undefined;
  },
};
`;

      const { proxy, testPort } = await setupWithInterceptor(observeInterceptorCode);

      const response = await makeProxiedRequest(
        proxy.port,
        `http://127.0.0.1:${testPort}/api/test`
      );

      expect(response.statusCode).toBe(200);
      const parsed = JSON.parse(response.body);
      expect(parsed).toEqual({ message: "hello from upstream" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const requests = storage.listRequests();
      expect(requests).toHaveLength(1);

      const captured = requests[0];
      expect(captured?.interceptedBy).toBe("test-observe");
      expect(captured?.interceptionType).toBeUndefined();
    });

    it("passes through to upstream when the interceptor match function does not match", async () => {
      const noMatchInterceptorCode = `
export default {
  name: "test-no-match",
  match: (req) => req.path === "/never/matches",
  handler: async () => ({
    status: 418,
    body: "should not see this",
  }),
};
`;

      const { proxy, testPort } = await setupWithInterceptor(noMatchInterceptorCode);

      const response = await makeProxiedRequest(
        proxy.port,
        `http://127.0.0.1:${testPort}/api/test`
      );

      // Should get the real upstream response, not the mock
      expect(response.statusCode).toBe(200);
      const parsed = JSON.parse(response.body);
      expect(parsed).toEqual({ message: "hello from upstream" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const requests = storage.listRequests();
      expect(requests).toHaveLength(1);

      // No interception metadata should be recorded
      const captured = requests[0];
      expect(captured?.interceptedBy).toBeUndefined();
      expect(captured?.interceptionType).toBeUndefined();
    });

    it("passes through to upstream when the interceptor handler throws an error", async () => {
      const errorInterceptorCode = `
export default {
  name: "test-error",
  match: (req) => req.path === "/api/test",
  handler: async () => {
    throw new Error("interceptor kaboom");
  },
};
`;

      const { proxy, testPort } = await setupWithInterceptor(errorInterceptorCode);

      const response = await makeProxiedRequest(
        proxy.port,
        `http://127.0.0.1:${testPort}/api/test`
      );

      // Graceful degradation: the upstream response should still be returned
      expect(response.statusCode).toBe(200);
      const parsed = JSON.parse(response.body);
      expect(parsed).toEqual({ message: "hello from upstream" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const requests = storage.listRequests();
      expect(requests).toHaveLength(1);

      // The handler threw before returning a result, so no interception should be recorded
      const captured = requests[0];
      expect(captured?.interceptedBy).toBeUndefined();
      expect(captured?.interceptionType).toBeUndefined();
    });

    it("filters stored requests by interceptedBy name", async () => {
      const mockInterceptorCode = `
export default {
  name: "named-mock",
  match: (req) => req.path === "/api/mocked",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mocked: true }),
  }),
};
`;

      const { proxy, testPort } = await setupWithInterceptor(mockInterceptorCode);

      // One request that matches the interceptor
      await makeProxiedRequest(proxy.port, `http://127.0.0.1:${testPort}/api/mocked`);
      // One request that passes through to upstream
      await makeProxiedRequest(proxy.port, `http://127.0.0.1:${testPort}/api/other`);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // All requests
      const allSummaries = storage.listRequestsSummary();
      expect(allSummaries).toHaveLength(2);

      // Filtered by interceptor name
      const filtered = storage.listRequestsSummary({
        filter: { interceptedBy: "named-mock" },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.interceptedBy).toBe("named-mock");
      expect(filtered[0]?.interceptionType).toBe("mocked");
    });

    it("mocks a fake HTTP domain without any upstream server", async () => {
      const fakeDomainInterceptorCode = `
export default {
  name: "fake-http-domain",
  match: (req) => req.host === "my-fake-api.local" && req.path === "/users",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ users: [{ id: 1, name: "Ada" }] }),
  }),
};
`;

      const { proxy } = await setupWithInterceptor(fakeDomainInterceptorCode);

      const response = await makeProxiedRequest(proxy.port, "http://my-fake-api.local/users");

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ users: [{ id: 1, name: "Ada" }] });

      await new Promise((resolve) => setTimeout(resolve, STORAGE_SETTLE_MS));

      const requests = storage.listRequests();
      const captured = requests.find((r) => r.url === "http://my-fake-api.local/users");

      expect(captured).toBeDefined();
      expect(captured?.interceptedBy).toBe("fake-http-domain");
      expect(captured?.interceptionType).toBe("mocked");
      expect(captured?.responseStatus).toBe(200);
    });

    it("mocks a fake HTTPS domain without any upstream server", async () => {
      const fakeDomainInterceptorCode = `
export default {
  name: "fake-https-domain",
  match: (req) => req.host === "my-fake-api.local" && req.path === "/users",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secure: true }),
  }),
};
`;

      const { proxy } = await setupWithInterceptor(fakeDomainInterceptorCode);
      const caCertPem = fs.readFileSync(paths.caCertFile, "utf8");

      const response = await makeProxiedHttpsRequest(
        proxy.port,
        "https://my-fake-api.local/users",
        caCertPem
      );

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ secure: true });

      await new Promise((resolve) => setTimeout(resolve, STORAGE_SETTLE_MS));

      const requests = storage.listRequests();
      const captured = requests.find((r) => r.url === "https://my-fake-api.local/users");

      expect(captured).toBeDefined();
      expect(captured?.interceptedBy).toBe("fake-https-domain");
      expect(captured?.interceptionType).toBe("mocked");
      expect(captured?.responseStatus).toBe(200);
    });

    it("fails cleanly for unmatched fake hosts and keeps the proxy alive", async () => {
      const selectiveInterceptorCode = `
export default {
  name: "fake-only-mock",
  match: (req) => req.host === "my-fake-api.local" && req.path === "/mock",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mocked: true }),
  }),
};
`;

      const { proxy } = await setupWithInterceptor(selectiveInterceptorCode);

      const unmatchedResult = await makeProxiedRequest(
        proxy.port,
        "http://my-fake-api.local/not-matched"
      )
        .then((response) => ({ response, error: undefined }))
        .catch((error: unknown) => ({ response: undefined, error }));

      if (unmatchedResult.response) {
        expect(unmatchedResult.response.statusCode).toBeGreaterThanOrEqual(500);
      } else {
        expect(unmatchedResult.error).toBeInstanceOf(Error);
      }

      const matchedResponse = await makeProxiedRequest(proxy.port, "http://my-fake-api.local/mock");
      expect(matchedResponse.statusCode).toBe(200);
      expect(JSON.parse(matchedResponse.body)).toEqual({ mocked: true });

      await new Promise((resolve) => setTimeout(resolve, STORAGE_SETTLE_MS));

      const mocked = storage
        .listRequests()
        .find(
          (r) => r.url === "http://my-fake-api.local/mock" && r.interceptedBy === "fake-only-mock"
        );
      expect(mocked).toBeDefined();
    });
  });

  describe("control API with interceptors", () => {
    it("lists loaded interceptors via the control API", async () => {
      const interceptorCode = `
export default {
  name: "ctrl-test",
  match: (req) => req.path === "/api/ctrl",
  handler: async () => ({
    status: 200,
    body: "ctrl",
  }),
};
`;

      fs.mkdirSync(paths.interceptorsDir, { recursive: true });
      fs.writeFileSync(path.join(paths.interceptorsDir, "ctrl.ts"), interceptorCode);

      const loader = await createInterceptorLoader({
        interceptorsDir: paths.interceptorsDir,
        projectRoot: tempDir,
        logLevel: "silent",
      });
      cleanup.push(async () => loader.close());

      const session = storage.registerSession("test", process.pid);
      const proxy = await createProxy({
        caKeyPath: paths.caKeyFile,
        caCertPath: paths.caCertFile,
        storage,
        sessionId: session.id,
      });
      cleanup.push(proxy.stop);

      const controlServer = createControlServer({
        socketPath: paths.controlSocketFile,
        storage,
        proxyPort: proxy.port,
        version: "1.0.0",
        interceptorLoader: loader,
      });
      cleanup.push(controlServer.close);

      const client = new ControlClient(paths.controlSocketFile);

      const interceptors = await client.listInterceptors();
      expect(interceptors).toHaveLength(1);
      expect(interceptors[0]?.name).toBe("ctrl-test");
      expect(interceptors[0]?.hasMatch).toBe(true);
      expect(interceptors[0]?.error).toBeUndefined();

      client.close();
    });

    it("reloads interceptors via the control API", async () => {
      const interceptorCode = `
export default {
  name: "reload-test",
  handler: async () => ({
    status: 200,
    body: "ok",
  }),
};
`;

      fs.mkdirSync(paths.interceptorsDir, { recursive: true });
      fs.writeFileSync(path.join(paths.interceptorsDir, "reload.ts"), interceptorCode);

      const loader = await createInterceptorLoader({
        interceptorsDir: paths.interceptorsDir,
        projectRoot: tempDir,
        logLevel: "silent",
      });
      cleanup.push(async () => loader.close());

      const session = storage.registerSession("test", process.pid);
      const proxy = await createProxy({
        caKeyPath: paths.caKeyFile,
        caCertPath: paths.caCertFile,
        storage,
        sessionId: session.id,
      });
      cleanup.push(proxy.stop);

      const controlServer = createControlServer({
        socketPath: paths.controlSocketFile,
        storage,
        proxyPort: proxy.port,
        version: "1.0.0",
        interceptorLoader: loader,
      });
      cleanup.push(controlServer.close);

      const client = new ControlClient(paths.controlSocketFile);

      const result = await client.reloadInterceptors();
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      client.close();
    });
  });
});
