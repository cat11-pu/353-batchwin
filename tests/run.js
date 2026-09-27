import assert from "node:assert";
import { ready, packOf } from "../batch.js";
import { step, close } from "../batchrun.js";
import { render } from "../app.js";

const base = {
  budget: 1, cap: 4,
  state: { window: [], batches: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "add", item: 1 }],
  bad_item_code: "E_BAD_ITEM", dup_code: "E_DUP_ITEM",
  empty_code: "E_EMPTY", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("ready returns a boolean", () => {
  assert.strictEqual(typeof ready([1], 4), "boolean");
});

check("packOf returns a list", () => {
  assert.ok(Array.isArray(packOf([1], [])));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
