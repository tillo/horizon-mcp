// node --test: float-pins.js turns exact pins into in-major overrides and merges lift.json.
const test = require("node:test");
const assert = require("node:assert");
const { overridesFor } = require("./float-pins.js");

const root = { dependencies: { supergateway: "4.2.1", "@evertrust/horizon-mcp": "2.1.2" } };
const pkgs = {
  supergateway: { dependencies: { "@modelcontextprotocol/sdk": "1.30.0", zod: "^3.25.76", yargs: "^18.0.0" } },
  "@evertrust/horizon-mcp": { dependencies: { undici: "8.11.2", zod: "4.3.6" } },
};
const read = (dep) => pkgs[dep];

test("exact pins float within their major; ranges are left alone", () => {
  const o = overridesFor(root, read, {});
  assert.deepStrictEqual(o, {
    supergateway: { ".": "4.2.1", "@modelcontextprotocol/sdk": "^1.30.0" },
    "@evertrust/horizon-mcp": { ".": "2.1.2", undici: "^8.11.2", zod: "^4.3.6" },
  });
});

test("lift.json adds a scoped cross-major override, and its _why is never emitted", () => {
  const lift = { supergateway: { zod: "^4.6.6", _why: "GHSA-mrhx-c7xc-m3w5 is fixed only in zod 4" } };
  const o = overridesFor(root, read, lift);
  assert.deepStrictEqual(o.supergateway, { ".": "4.2.1", "@modelcontextprotocol/sdk": "^1.30.0", zod: "^4.6.6" });
});

test("a lift for a dependency without exact pins still pins the dependency itself", () => {
  const o = overridesFor({ dependencies: { a: "1.0.0" } }, () => ({ dependencies: {} }), { a: { b: "^2.0.0" } });
  assert.deepStrictEqual(o, { a: { ".": "1.0.0", b: "^2.0.0" } });
});

test("a lift naming a package that is not a direct dependency fails loudly", () => {
  assert.throws(() => overridesFor(root, read, { nope: { zod: "^4.0.0" } }), /not a direct dependency/);
});

test("no dependencies anywhere and no lift: nothing to override", () => {
  assert.deepStrictEqual(overridesFor({}, () => ({}), undefined), {});
  assert.deepStrictEqual(overridesFor({ dependencies: { a: "1.0.0" } }, () => ({}), null), {});
});
