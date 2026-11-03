// float-pins.js <dir>: build-time helper (Dockerfile). supergateway and the MCP
// package pin some of their own dependencies EXACTLY (e.g. sdk 1.30.0, undici
// 8.11.2), so a published fix inside the same major never reaches the image and
// npm's root `overrides` cannot be applied to a global install. For every direct
// dependency D of <dir>/package.json, each exact pin E=x.y.z in D's package.json
// becomes the scoped override {D: {".": <D's version>, E: "^x.y.z"}}: the newest
// release of E within its major. Writes them into <dir>/package.json; prints them.
// Run after a first install (it reads node_modules), then reinstall from scratch.
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
const file = path.join(dir, "package.json");
const root = JSON.parse(fs.readFileSync(file, "utf8"));
const overrides = {};
for (const [dep, version] of Object.entries(root.dependencies || {})) {
  const own = JSON.parse(fs.readFileSync(path.join(dir, "node_modules", dep, "package.json"), "utf8"));
  for (const [pinned, v] of Object.entries(own.dependencies || {})) {
    if (/^\d+\.\d+\.\d+$/.test(v)) (overrides[dep] ??= { ".": version })[pinned] = `^${v}`;
  }
}
root.overrides = overrides;
fs.writeFileSync(file, `${JSON.stringify(root, null, 2)}\n`);
console.log(JSON.stringify(overrides));
