// Tests for testflight-external.mjs. Run with `node --test '.github/scripts/*.test.mjs'`.
// The real script runs against a stub App Store Connect, so no Apple account,
// network or native app is needed.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(HERE, "testflight-external.mjs");

const STARTED = "2026-11-11T10:00:00Z";
const build = (id, version, uploadedDate, processingState = "VALID") => ({
  id,
  attributes: { version, uploadedDate, processingState },
});

// `state` describes App Store Connect. `builds` is a list of answers to the
// builds query, served one per poll (the last repeats); `beta` likewise for
// the build's beta state.
function run({ builds, beta = ["READY_FOR_BETA_SUBMISSION"], localizations = [], env = {} }) {
  const dir = mkdtempSync(join(tmpdir(), "tf-"));
  try {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    writeFileSync(join(dir, "key.p8"), privateKey.export({ type: "pkcs8", format: "pem" }));
    writeFileSync(join(dir, "whats-new.md"), "- Dino Run ducks faster\n");
    const log = join(dir, "requests.log");
    const state = { builds, beta, localizations };
    writeFileSync(
      join(dir, "stub.mjs"),
      `import { appendFileSync } from 'node:fs';
const state = ${JSON.stringify(state)};
let buildPolls = 0, betaPolls = 0;
const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
globalThis.fetch = async (url, { method, body }) => {
  const path = new URL(url).pathname + new URL(url).search;
  appendFileSync(${JSON.stringify(log)}, method + ' ' + path + (body ? ' ' + body : '') + '\\n');
  if (method !== 'GET') return new Response(null, { status: method === 'POST' ? 201 : 200 });
  if (path.startsWith('/v1/apps?')) return ok({ data: [{ id: 'APP', attributes: { bundleId: 'codes.pgd.app' } }] });
  if (path.startsWith('/v1/betaGroups?')) return ok({ data: [{ id: 'GROUP', attributes: { name: 'Public beta' } }] });
  if (path.startsWith('/v1/builds?')) return ok({ data: state.builds[Math.min(buildPolls++, state.builds.length - 1)] });
  if (path.endsWith('/betaBuildLocalizations')) return ok({ data: state.localizations });
  if (path.endsWith('/buildBetaDetail')) {
    const s = state.beta[Math.min(betaPolls++, state.beta.length - 1)];
    return ok({ data: { id: 'DETAIL', attributes: { externalBuildState: s, autoNotifyEnabled: false } } });
  }
  return new Response('unexpected ' + path, { status: 404 });
};`,
    );
    let status = 0;
    let output = "";
    try {
      output = execFileSync(process.execPath, ["--import", join(dir, "stub.mjs"), scriptPath], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          GITHUB_STEP_SUMMARY: "",
          APP_STORE_KEY_ID: "KEY",
          APP_STORE_ISSUER_ID: "ISSUER",
          APP_STORE_KEY_PATH: join(dir, "key.p8"),
          BUNDLE_ID: "codes.pgd.app",
          VERSION: "1.4.0",
          UPLOADED_AFTER: STARTED,
          EXTERNAL_GROUP: "Public beta",
          PLATFORMS: "IOS",
          WHATS_NEW_FILE: join(dir, "whats-new.md"),
          POLL_SECONDS: "0",
          ASC_RETRY_MS: "1",
          ...env,
        },
      });
    } catch (error) {
      status = error.status;
      output = `${error.stdout}${error.stderr}`;
    }
    const requests = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
    return { status, output, requests, writes: requests.filter((r) => !r.startsWith("GET")) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const added = (writes, id) =>
  writes.some((w) => w.startsWith("POST /v1/betaGroups/GROUP/relationships/builds") && w.includes(`"id":"${id}"`));

describe("TestFlight external stage", () => {
  it("waits for processing, then sets What to Test, adds the build and submits it", () => {
    const out = run({
      builds: [[], [build("B1", "29300000", "2026-11-11T10:05:00Z", "PROCESSING")], [build("B1", "29300000", "2026-11-11T10:05:00Z")]],
    });
    assert.equal(out.status, 0, out.output);
    assert.ok(out.writes.some((w) => w.startsWith("POST /v1/betaBuildLocalizations") && w.includes("Dino Run")));
    assert.ok(out.writes.some((w) => w.startsWith("PATCH /v1/buildBetaDetails/DETAIL")));
    assert.ok(added(out.writes, "B1"));
    assert.ok(out.writes.some((w) => w.startsWith("POST /v1/betaAppReviewSubmissions")));
  });

  it("only takes the build number this run uploaded", () => {
    const out = run({
      builds: [[build("FROM_A_MAC", "29300009", "2026-11-11T10:09:00Z"), build("OURS", "29300000", "2026-11-11T10:05:00Z")]],
      env: { BUILD_NUMBER: "29300000" },
    });
    assert.equal(out.status, 0, out.output);
    assert.ok(out.requests.some((r) => r.includes("filter%5Bversion%5D=29300000")));
    assert.ok(added(out.writes, "OURS"));
    assert.ok(!added(out.writes, "FROM_A_MAC"));
  });

  it("ignores builds uploaded before this run started", () => {
    const out = run({
      builds: [[build("OLD", "29200000", "2026-11-10T09:00:00Z")]],
      env: { WAIT_MINUTES: "0.002" },
    });
    assert.notEqual(out.status, 0);
    assert.match(out.output, /no processed 1\.4\.0 build before the deadline/);
    assert.ok(!added(out.writes, "OLD"));
  });

  it("stops on a build App Store Connect rejected", () => {
    const out = run({ builds: [[build("B1", "29300000", "2026-11-11T10:05:00Z", "INVALID")]] });
    assert.notEqual(out.status, 0);
    assert.match(out.output, /is INVALID in App Store Connect/);
    assert.deepEqual(out.writes, []);
  });

  it("updates What to Test in place when the localisation already exists", () => {
    const out = run({
      builds: [[build("B1", "29300000", "2026-11-11T10:05:00Z")]],
      localizations: [{ id: "LOC", attributes: { locale: "en-US" } }],
    });
    assert.equal(out.status, 0, out.output);
    assert.ok(out.writes.some((w) => w.startsWith("PATCH /v1/betaBuildLocalizations/LOC")));
    assert.ok(!out.writes.some((w) => w.startsWith("POST /v1/betaBuildLocalizations")));
  });

  it("does not submit again a build already waiting for review", () => {
    const out = run({
      builds: [[build("B1", "29300000", "2026-11-11T10:05:00Z")]],
      beta: ["READY_FOR_BETA_SUBMISSION", "WAITING_FOR_BETA_REVIEW"],
    });
    assert.equal(out.status, 0, out.output);
    assert.ok(added(out.writes, "B1"));
    assert.ok(!out.writes.some((w) => w.startsWith("POST /v1/betaAppReviewSubmissions")));
  });

  it("explains a missing export compliance answer", () => {
    const out = run({
      builds: [[build("B1", "29300000", "2026-11-11T10:05:00Z")]],
      beta: ["READY_FOR_BETA_SUBMISSION", "MISSING_EXPORT_COMPLIANCE"],
    });
    assert.notEqual(out.status, 0);
    assert.match(out.output, /ITSAppUsesNonExemptEncryption/);
  });
});
