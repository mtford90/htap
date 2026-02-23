import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { Command } from "commander";
import { ensureProcsiDir, getProcsiPaths } from "../../shared/project.js";
import { startDaemon } from "../../shared/daemon.js";
import { ControlClient } from "../../shared/control-client.js";
import { parseVerbosity } from "../../shared/logger.js";
import { getErrorMessage, getGlobalOptions, resolveProjectContext } from "./helpers.js";
import { detectBrowsers, findBrowser, launchBrowser } from "../../shared/browser.js";

export const browserCommand = new Command("browser")
  .description("Launch a browser pre-configured to use the procsi proxy")
  .argument("[url]", "URL to open in the browser")
  .option("-b, --browser <name>", "Browser to use (chrome, firefox). Auto-detected if omitted.")
  .option("-l, --label <label>", "Session label (defaults to browser name)")
  .action(
    async (
      url: string | undefined,
      options: { browser?: string; label?: string },
      command: Command
    ) => {
      const globalOpts = getGlobalOptions(command);
      const verbosity = globalOpts.verbose;
      const logLevel = parseVerbosity(verbosity);

      // Detect available browsers
      const browsers = detectBrowsers();
      if (browsers.length === 0) {
        console.error("No supported browsers found (Chrome, Chromium, or Firefox).");
        process.exit(1);
      }

      // Find the requested browser
      const browser = findBrowser(browsers, options.browser);
      if (!browser) {
        const available = browsers.map((b) => `${b.name} (${b.type})`).join(", ");
        console.error(`Browser "${options.browser}" not found. Available: ${available}`);
        process.exit(1);
      }

      // Ensure project root and daemon
      const projectRoot = resolveProjectContext(globalOpts);
      ensureProcsiDir(projectRoot);
      const paths = getProcsiPaths(projectRoot);

      let proxyPort: number;
      try {
        proxyPort = await startDaemon(projectRoot, {
          logLevel,
          onVersionMismatch: (running, cli) => {
            console.log(`Restarting daemon (version mismatch: ${running} -> ${cli})`);
          },
        });
      } catch (err) {
        console.error(`Failed to start daemon: ${getErrorMessage(err)}`);
        process.exit(1);
      }

      // Register a session for the browser
      const label = options.label ?? browser.name;
      const client = new ControlClient(paths.controlSocketFile);
      let sessionId: string;
      let sessionToken: string;

      try {
        const session = await client.registerSession(label, undefined, browser.type);
        sessionId = session.id;
        sessionToken = session.token;
      } catch (err) {
        client.close();
        console.error(`Failed to register session: ${getErrorMessage(err)}`);
        process.exit(1);
      } finally {
        client.close();
      }

      // Create a temporary profile directory
      const profileId = crypto.randomUUID();
      const profileDir = path.join(paths.browserProfilesDir, profileId);
      fs.mkdirSync(profileDir, { recursive: true });

      // Launch the browser
      let child;
      try {
        child = launchBrowser(browser, {
          proxyPort,
          caCertPath: paths.caCertFile,
          sessionId,
          sessionToken,
          profileDir,
          url,
        });
      } catch (err) {
        // Clean up profile on launch failure
        fs.rmSync(profileDir, { recursive: true, force: true });
        console.error(`Failed to launch browser: ${getErrorMessage(err)}`);
        process.exit(1);
      }

      const proxyUrl = `http://127.0.0.1:${proxyPort}`;
      console.log(`Browser: ${browser.name}`);
      console.log(`Proxy:   ${proxyUrl}`);
      console.log(`Session: ${sessionId} (source: ${browser.type})`);
      console.log("");
      console.log("Press Ctrl+C to stop, or close the browser window.");

      // Wait for browser exit or signal
      const cleanup = () => {
        try {
          fs.rmSync(profileDir, { recursive: true, force: true });
        } catch {
          // Best-effort cleanup
        }
      };

      child.on("exit", () => {
        cleanup();
        process.exit(0);
      });

      const handleSignal = () => {
        // Kill the browser process group
        if (child.pid) {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            // Process may have already exited
          }
        }
        cleanup();
        process.exit(0);
      };

      process.on("SIGINT", handleSignal);
      process.on("SIGTERM", handleSignal);
    }
  );
