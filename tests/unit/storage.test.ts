import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import Database from "better-sqlite3";
import { RequestRepository } from "../../src/daemon/storage.js";

describe("RequestRepository", () => {
  let tempDir: string;
  let dbPath: string;
  let repo: RequestRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "htpx-storage-test-"));
    dbPath = path.join(tempDir, "test.db");
    repo = new RequestRepository(dbPath);
  });

  afterEach(() => {
    repo.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("sessions", () => {
    it("registers a session with label", () => {
      const session = repo.registerSession("my-label", 12345);

      expect(session.id).toBeDefined();
      expect(session.label).toBe("my-label");
      expect(session.pid).toBe(12345);
      expect(session.startedAt).toBeDefined();
    });

    it("registers a session without label", () => {
      const session = repo.registerSession(undefined, 12345);

      expect(session.id).toBeDefined();
      expect(session.label).toBeUndefined();
    });

    it("retrieves a session by ID", () => {
      const created = repo.registerSession("test", 1);

      const retrieved = repo.getSession(created.id);

      expect(retrieved).toEqual(created);
    });

    it("returns undefined for non-existent session", () => {
      const result = repo.getSession("non-existent");
      expect(result).toBeUndefined();
    });

    it("lists all sessions", () => {
      repo.registerSession("first", 1);
      repo.registerSession("second", 2);

      const sessions = repo.listSessions();

      expect(sessions).toHaveLength(2);
    });
  });

  describe("ensureSession", () => {
    it("creates a new session with specified ID", () => {
      const session = repo.ensureSession("my-id", "my-label", 12345);

      expect(session.id).toBe("my-id");
      expect(session.label).toBe("my-label");
      expect(session.pid).toBe(12345);
      expect(session.startedAt).toBeDefined();
    });

    it("returns existing session if ID already exists", () => {
      const first = repo.ensureSession("same-id", "first", 111);
      const second = repo.ensureSession("same-id", "second", 222);

      // Should return the original session, not update it
      expect(second.id).toBe("same-id");
      expect(second.label).toBe("first"); // Original label preserved
      expect(second.pid).toBe(111); // Original PID preserved
      expect(second.startedAt).toBe(first.startedAt);
    });

    it("uses process.pid as default when pid not specified", () => {
      const session = repo.ensureSession("default-pid-id", "test");

      expect(session.pid).toBe(process.pid);
    });
  });

  describe("requests", () => {
    let sessionId: string;

    beforeEach(() => {
      const session = repo.registerSession("test", 1);
      sessionId = session.id;
    });

    it("saves and retrieves a request", () => {
      const id = repo.saveRequest({
        sessionId,
        label: "api",
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/users",
        host: "api.example.com",
        path: "/users",
        requestHeaders: { "Content-Type": "application/json" },
      });

      const request = repo.getRequest(id);

      expect(request).toBeDefined();
      expect(request?.method).toBe("GET");
      expect(request?.url).toBe("https://api.example.com/users");
      expect(request?.requestHeaders).toEqual({ "Content-Type": "application/json" });
    });

    it("saves request with body", () => {
      const body = Buffer.from('{"name":"test"}');
      const id = repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "POST",
        url: "https://api.example.com/users",
        host: "api.example.com",
        path: "/users",
        requestHeaders: {},
        requestBody: body,
      });

      const request = repo.getRequest(id);

      expect(request?.requestBody).toEqual(body);
    });

    it("updates request with response", () => {
      const id = repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/users",
        host: "api.example.com",
        path: "/users",
        requestHeaders: {},
      });

      repo.updateRequestResponse(id, {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from('[{"id":1}]'),
        durationMs: 150,
      });

      const request = repo.getRequest(id);

      expect(request?.responseStatus).toBe(200);
      expect(request?.responseHeaders).toEqual({ "Content-Type": "application/json" });
      expect(request?.responseBody?.toString()).toBe('[{"id":1}]');
      expect(request?.durationMs).toBe(150);
    });

    it("lists requests", () => {
      repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/users",
        host: "api.example.com",
        path: "/users",
        requestHeaders: {},
      });

      repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "POST",
        url: "https://api.example.com/users",
        host: "api.example.com",
        path: "/users",
        requestHeaders: {},
      });

      const requests = repo.listRequests();

      expect(requests).toHaveLength(2);
    });

    it("filters requests by session", () => {
      const otherSession = repo.registerSession("other", 2);

      repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/a",
        host: "api.example.com",
        path: "/a",
        requestHeaders: {},
      });

      repo.saveRequest({
        sessionId: otherSession.id,
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/b",
        host: "api.example.com",
        path: "/b",
        requestHeaders: {},
      });

      const requests = repo.listRequests({ sessionId });

      expect(requests).toHaveLength(1);
      expect(requests[0]?.path).toBe("/a");
    });

    it("filters requests by label", () => {
      repo.saveRequest({
        sessionId,
        label: "api",
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/a",
        host: "api.example.com",
        path: "/a",
        requestHeaders: {},
      });

      repo.saveRequest({
        sessionId,
        label: "web",
        timestamp: Date.now(),
        method: "GET",
        url: "https://web.example.com/b",
        host: "web.example.com",
        path: "/b",
        requestHeaders: {},
      });

      const requests = repo.listRequests({ label: "api" });

      expect(requests).toHaveLength(1);
      expect(requests[0]?.host).toBe("api.example.com");
    });

    it("paginates requests with limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        repo.saveRequest({
          sessionId,
          timestamp: Date.now() + i,
          method: "GET",
          url: `https://api.example.com/${i}`,
          host: "api.example.com",
          path: `/${i}`,
          requestHeaders: {},
        });
      }

      const page1 = repo.listRequests({ limit: 2 });
      const page2 = repo.listRequests({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });

    it("counts requests", () => {
      repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/a",
        host: "api.example.com",
        path: "/a",
        requestHeaders: {},
      });

      repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "POST",
        url: "https://api.example.com/b",
        host: "api.example.com",
        path: "/b",
        requestHeaders: {},
      });

      const count = repo.countRequests();

      expect(count).toBe(2);
    });

    it("counts requests with filter", () => {
      repo.saveRequest({
        sessionId,
        label: "api",
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/a",
        host: "api.example.com",
        path: "/a",
        requestHeaders: {},
      });

      repo.saveRequest({
        sessionId,
        label: "web",
        timestamp: Date.now(),
        method: "GET",
        url: "https://web.example.com/b",
        host: "web.example.com",
        path: "/b",
        requestHeaders: {},
      });

      const count = repo.countRequests({ label: "api" });

      expect(count).toBe(1);
    });

    it("clears all requests", () => {
      repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/a",
        host: "api.example.com",
        path: "/a",
        requestHeaders: {},
      });

      repo.clearRequests();

      const count = repo.countRequests();
      expect(count).toBe(0);
    });
  });

  describe("listRequestsSummary", () => {
    let sessionId: string;

    beforeEach(() => {
      const session = repo.registerSession("test", 1);
      sessionId = session.id;
    });

    it("returns summaries without body data", () => {
      const requestBody = Buffer.from('{"name":"test"}');
      const responseBody = Buffer.from('{"id":1}');

      const id = repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "POST",
        url: "https://api.example.com/users",
        host: "api.example.com",
        path: "/users",
        requestHeaders: { "Content-Type": "application/json" },
        requestBody,
      });

      repo.updateRequestResponse(id, {
        status: 201,
        headers: { "Content-Type": "application/json" },
        body: responseBody,
        durationMs: 100,
      });

      const summaries = repo.listRequestsSummary();

      expect(summaries).toHaveLength(1);
      const summary = summaries[0];
      expect(summary).toBeDefined();

      // Should have metadata
      expect(summary?.id).toBe(id);
      expect(summary?.method).toBe("POST");
      expect(summary?.url).toBe("https://api.example.com/users");
      expect(summary?.responseStatus).toBe(201);
      expect(summary?.durationMs).toBe(100);

      // Should have body sizes
      expect(summary?.requestBodySize).toBe(requestBody.length);
      expect(summary?.responseBodySize).toBe(responseBody.length);

      // Should NOT have body data (these fields don't exist on summary type)
      if (summary) {
        expect("requestBody" in summary).toBe(false);
        expect("responseBody" in summary).toBe(false);
        expect("requestHeaders" in summary).toBe(false);
        expect("responseHeaders" in summary).toBe(false);
      }
    });

    it("returns zero for null body sizes", () => {
      repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/users",
        host: "api.example.com",
        path: "/users",
        requestHeaders: {},
      });

      const summaries = repo.listRequestsSummary();

      expect(summaries[0]?.requestBodySize).toBe(0);
      expect(summaries[0]?.responseBodySize).toBe(0);
    });

    it("filters by session", () => {
      const otherSession = repo.registerSession("other", 2);

      repo.saveRequest({
        sessionId,
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/a",
        host: "api.example.com",
        path: "/a",
        requestHeaders: {},
      });

      repo.saveRequest({
        sessionId: otherSession.id,
        timestamp: Date.now(),
        method: "GET",
        url: "https://api.example.com/b",
        host: "api.example.com",
        path: "/b",
        requestHeaders: {},
      });

      const summaries = repo.listRequestsSummary({ sessionId });

      expect(summaries).toHaveLength(1);
      expect(summaries[0]?.path).toBe("/a");
    });

    it("supports pagination", () => {
      for (let i = 0; i < 5; i++) {
        repo.saveRequest({
          sessionId,
          timestamp: Date.now() + i,
          method: "GET",
          url: `https://api.example.com/${i}`,
          host: "api.example.com",
          path: `/${i}`,
          requestHeaders: {},
        });
      }

      const page1 = repo.listRequestsSummary({ limit: 2 });
      const page2 = repo.listRequestsSummary({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });
  });

  describe("migrations", () => {
    // Old schema without truncation columns
    const OLD_SCHEMA = `
      CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          label TEXT,
          pid INTEGER NOT NULL,
          started_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          label TEXT,
          timestamp INTEGER NOT NULL,
          method TEXT NOT NULL,
          url TEXT NOT NULL,
          host TEXT NOT NULL,
          path TEXT NOT NULL,
          request_headers TEXT,
          request_body BLOB,
          response_status INTEGER,
          response_headers TEXT,
          response_body BLOB,
          duration_ms INTEGER,
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_requests_session ON requests(session_id);
      CREATE INDEX IF NOT EXISTS idx_requests_label ON requests(label);
    `;

    it("applies migrations to old schema", () => {
      // Create a DB with the old schema (no truncation columns)
      const migrationDir = fs.mkdtempSync(path.join(os.tmpdir(), "htpx-migration-test-"));
      const migrationDbPath = path.join(migrationDir, "old.db");

      const rawDb = new Database(migrationDbPath);
      rawDb.exec(OLD_SCHEMA);

      // Insert a row so it looks like an existing DB
      rawDb.exec(`
        INSERT INTO sessions (id, label, pid, started_at)
        VALUES ('s1', 'test', 1, 1000)
      `);
      rawDb.exec(`
        INSERT INTO requests (id, session_id, timestamp, method, url, host, path)
        VALUES ('r1', 's1', 1000, 'GET', 'http://example.com', 'example.com', '/')
      `);
      rawDb.close();

      // Open with RequestRepository — migrations should apply
      const migratedRepo = new RequestRepository(migrationDbPath);
      const request = migratedRepo.getRequest("r1");
      expect(request).toBeDefined();
      expect(request?.requestBodyTruncated).toBe(false);
      expect(request?.responseBodyTruncated).toBe(false);

      // Verify user_version was set
      const checkDb = new Database(migrationDbPath);
      const version = checkDb.pragma("user_version", { simple: true });
      expect(version).toBe(1);
      checkDb.close();

      migratedRepo.close();
      fs.rmSync(migrationDir, { recursive: true, force: true });
    });

    it("skips migrations on fresh database", () => {
      // The default repo from beforeEach is a fresh DB
      const checkDb = new Database(dbPath);
      const version = checkDb.pragma("user_version", { simple: true });
      expect(version).toBe(1);
      checkDb.close();
    });

    it("is idempotent when opened multiple times", () => {
      const idempotentDir = fs.mkdtempSync(path.join(os.tmpdir(), "htpx-idempotent-test-"));
      const idempotentDbPath = path.join(idempotentDir, "test.db");

      const repo1 = new RequestRepository(idempotentDbPath);
      repo1.close();

      // Opening again should not throw
      const repo2 = new RequestRepository(idempotentDbPath);
      repo2.close();

      fs.rmSync(idempotentDir, { recursive: true, force: true });
    });

    it("propagates real errors instead of swallowing them", () => {
      const errorDir = fs.mkdtempSync(path.join(os.tmpdir(), "htpx-error-test-"));
      const errorDbPath = path.join(errorDir, "error.db");

      // Create an old-schema DB with data so migrations will run
      const rawDb = new Database(errorDbPath);
      rawDb.exec(OLD_SCHEMA);
      rawDb.exec(`
        INSERT INTO sessions (id, label, pid, started_at)
        VALUES ('s1', 'test', 1, 1000)
      `);
      rawDb.exec(`
        INSERT INTO requests (id, session_id, timestamp, method, url, host, path)
        VALUES ('r1', 's1', 1000, 'GET', 'http://example.com', 'example.com', '/')
      `);

      // Apply the real migrations first so we can test with a bad one
      // Set version to 1 so real migrations pass, then add a broken migration at version 2
      rawDb.pragma("user_version = 0");

      // Corrupt the DB by making the requests table read-only isn't feasible,
      // but we can test by manually creating a scenario where migration SQL is invalid.
      // We'll apply migration v1 manually, then test that a hypothetical bad v2 would fail.
      rawDb.exec("ALTER TABLE requests ADD COLUMN request_body_truncated INTEGER DEFAULT 0");
      rawDb.exec("ALTER TABLE requests ADD COLUMN response_body_truncated INTEGER DEFAULT 0");
      // Don't set user_version — so RequestRepository will try to apply migration v1 again
      // This simulates a real error (duplicate column)
      rawDb.close();

      expect(() => new RequestRepository(errorDbPath)).toThrow();

      fs.rmSync(errorDir, { recursive: true, force: true });
    });

    it("rolls back all migrations on failure", () => {
      const rollbackDir = fs.mkdtempSync(path.join(os.tmpdir(), "htpx-rollback-test-"));
      const rollbackDbPath = path.join(rollbackDir, "rollback.db");

      // Create a DB with old schema and data
      const rawDb = new Database(rollbackDbPath);
      rawDb.exec(OLD_SCHEMA);
      rawDb.exec(`
        INSERT INTO sessions (id, label, pid, started_at)
        VALUES ('s1', 'test', 1, 1000)
      `);
      rawDb.exec(`
        INSERT INTO requests (id, session_id, timestamp, method, url, host, path)
        VALUES ('r1', 's1', 1000, 'GET', 'http://example.com', 'example.com', '/')
      `);
      rawDb.close();

      // Open will try migration v1 which should succeed on this old schema
      // To test rollback, we need a multi-migration scenario where the second fails.
      // Apply v1 manually and set version to 0 so it tries again, causing failure.
      const setupDb = new Database(rollbackDbPath);
      setupDb.exec("ALTER TABLE requests ADD COLUMN request_body_truncated INTEGER DEFAULT 0");
      // Leave response_body_truncated missing — so v1 migration will partially succeed
      // then fail on the second ALTER (request_body_truncated already exists)
      // Actually, the whole v1 SQL runs as one exec, so the first ALTER will fail.
      // Let's instead not add request_body_truncated but add response_body_truncated:
      setupDb.exec("ALTER TABLE requests ADD COLUMN response_body_truncated INTEGER DEFAULT 0");
      // Now v1 migration will succeed on the first ALTER but fail on the second (duplicate column)
      // Wait — both are in the same exec() call. SQLite exec runs them sequentially
      // and stops at first error. So request_body_truncated will be added, then
      // response_body_truncated will fail. The transaction should roll back both.
      setupDb.close();

      // Undo our manual changes and set up correctly for the test
      const resetDb = new Database(rollbackDbPath);
      // Drop and recreate to get clean state
      resetDb.exec("DROP TABLE requests");
      resetDb.exec("DROP TABLE sessions");
      resetDb.exec(OLD_SCHEMA);
      resetDb.exec(`
        INSERT INTO sessions (id, label, pid, started_at)
        VALUES ('s1', 'test', 1, 1000)
      `);
      resetDb.exec(`
        INSERT INTO requests (id, session_id, timestamp, method, url, host, path)
        VALUES ('r1', 's1', 1000, 'GET', 'http://example.com', 'example.com', '/')
      `);
      // Add only response_body_truncated — so v1's second ALTER will fail
      resetDb.exec("ALTER TABLE requests ADD COLUMN response_body_truncated INTEGER DEFAULT 0");
      resetDb.pragma("user_version = 0");
      resetDb.close();

      // RequestRepository should fail because migration v1 will try to add
      // response_body_truncated which already exists
      expect(() => new RequestRepository(rollbackDbPath)).toThrow();

      // Verify version stayed at 0 (transaction rolled back)
      const checkDb = new Database(rollbackDbPath);
      const version = checkDb.pragma("user_version", { simple: true });
      expect(version).toBe(0);

      // Verify request_body_truncated was NOT added (rolled back)
      const columns = checkDb.prepare("PRAGMA table_info(requests)").all() as { name: string }[];
      const columnNames = columns.map((c) => c.name);
      expect(columnNames).not.toContain("request_body_truncated");

      checkDb.close();
      fs.rmSync(rollbackDir, { recursive: true, force: true });
    });
  });
});
