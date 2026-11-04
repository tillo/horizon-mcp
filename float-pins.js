// float-pins.js <dir>: build-time helper (Dockerfile). supergateway and the MCP
// package pin some of their own dependencies EXACTLY (e.g. sdk 1.30.0, undici
// 8.11.2), so a published fix inside the same major never reaches the image and
// npm's root `overrides` cannot be applied to a global install. For every direct
// dependency D of <dir>/package.json, each exact pin E=x.y.z in D's package.json
// becomes the scoped override {D: {".": <D's version>, E: "^x.y.z"}}: the newest
// release of E within its major. Writes them into <dir>/package.json; prints them.
// Run after a first install (it reads node_modules), then reinstall from scratch.
//
// lift.json (next to this script, optional): scoped overrides that CROSS a major,
// which floating can never do - {D: {E: "<range>", "_why": "<advisory + proof>"}}.
// Each one is a deliberate decision and the build's smoke test is its proof; `_why`
// is documentation only and never reaches package.json. A lift for a package that
// is not a direct dependency fails the build instead of silently doing nothing.
const fs = require("fs");
const path = require("path");

function floatPins(deps, readPkg) {
  const overrides = {};
  for (const [dep, version] of Object.entries(deps)) {
    for (const [pinned, v] of Object.entries(readPkg(dep).dependencies || {})) {
      if (/^\d+\.\d+\.\d+$/.test(v)) (overrides[dep] ??= { ".": version })[pinned] = `^${v}`;
    }
  }
  return overrides;
}

function applyLift(overrides, deps, lift) {
  for (const [dep, rules] of Object.entries(lift)) {
    if (!(dep in deps)) throw new Error(`lift.json: ${dep} is not a direct dependency`);
    const scoped = (overrides[dep] ??= { ".": deps[dep] });
    for (const [pkg, range] of Object.entries(rules)) if (pkg !== "_why") scoped[pkg] = range;
  }
  return overrides;
}

function overridesFor(root, readPkg, lift) {
  const deps = root.dependencies || {};
  return applyLift(floatPins(deps, readPkg), deps, lift || {});
}

function main(dir) {
  const file = path.join(dir, "package.json");
  const root = JSON.parse(fs.readFileSync(file, "utf8"));
  const readPkg = (dep) =>
    JSON.parse(fs.readFileSync(path.join(dir, "node_modules", dep, "package.json"), "utf8"));
  const liftFile = path.join(__dirname, "lift.json");
  const lift = fs.existsSync(liftFile) ? JSON.parse(fs.readFileSync(liftFile, "utf8")) : {};
  root.overrides = overridesFor(root, readPkg, lift);
  fs.writeFileSync(file, `${JSON.stringify(root, null, 2)}\n`);
  console.log(JSON.stringify(root.overrides));
}

if (require.main === module) main(process.argv[2]);
module.exports = { overridesFor };
