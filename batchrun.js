// batchrun.js：按处理预算处理事件，用尽的部分压账；收尾不限预算清账
import { ready, packOf } from "./batch.js";

const CODES = {
  badItem: "E_BAD_ITEM",
  dup: "E_DUP_ITEM",
  empty: "E_EMPTY",
  badEvent: "E_BAD_EVENT"
};

function fail(code, message) {
  const error = new Error(message || code);
  error.code = code;
  throw error;
}

function codeOf(spec, key, fallback) {
  return (spec && spec[key]) || fallback;
}

function cloneState(state) {
  const source = state || {};
  return {
    window: Array.isArray(source.window) ? source.window.slice() : [],
    batches: Array.isArray(source.batches)
      ? source.batches.map(function (row) {
          return [row[0], Array.isArray(row[1]) ? row[1].slice() : []];
        })
      : [],
    ledger: Array.isArray(source.ledger)
      ? source.ledger.map(function (row) { return row.slice(); })
      : [],
    applied: Array.isArray(source.applied) ? source.applied.slice() : []
  };
}

// 结构与项目号先校验（与预算无关）：不合法直接抛错
function validateEvent(spec, event) {
  const badEvent = codeOf(spec, "event_error_code", CODES.badEvent);
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail(badEvent);
  }
  if (event.kind !== "add" && event.kind !== "seal") {
    fail(badEvent);
  }
  if (event.kind === "add") {
    if (!Number.isInteger(event.item) || event.item <= 0) {
      fail(codeOf(spec, "bad_item_code", CODES.badItem));
    }
  }
}

// 真正应用一条事件（结构与项目号已校验过）
function applyEvent(spec, state, event) {
  if (event.kind === "add") {
    if (state.window.indexOf(event.item) !== -1) {
      fail(codeOf(spec, "dup_code", CODES.dup));
    }
    if (ready(state.window, spec.cap)) {
      state.batches = packOf(state.window, state.batches);
      state.window = [];
    }
    state.window.push(event.item);
  } else {
    if (state.window.length === 0) {
      fail(codeOf(spec, "empty_code", CODES.empty));
    }
    state.batches = packOf(state.window, state.batches);
    state.window = [];
  }
}

export function step(spec) {
  const input = spec || {};
  const events = Array.isArray(input.events) ? input.events : [];
  const state = cloneState(input.state);
  const budget = Number.isFinite(input.budget) && input.budget > 0
    ? Math.floor(input.budget) : 0;

  // 第一档校验：所有事件先过结构与项目号
  events.forEach(function (event) { validateEvent(input, event); });

  let served = 0;
  let remaining = budget;

  events.forEach(function (event) {
    // 重放幂等：已应用过的事件直接跳过
    if (event && Object.prototype.hasOwnProperty.call(event, "id")
      && state.applied.indexOf(event.id) !== -1) {
      return;
    }
    if (remaining <= 0) {
      // 预算用尽：连着压账，id 记账以便重放不重复
      state.ledger.push(event.kind === "add"
        ? ["add", event.item] : ["seal"]);
      if (event && Object.prototype.hasOwnProperty.call(event, "id")) {
        state.applied.push(event.id);
      }
      return;
    }
    remaining -= 1;
    applyEvent(input, state, event);
    served += 1;
    if (event && Object.prototype.hasOwnProperty.call(event, "id")) {
      state.applied.push(event.id);
    }
  });

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return row.slice(); }),
    judged: served,
    judged_bound: events.length
  };
}

export function close(spec) {
  const input = spec || {};
  const state = cloneState(input.state);
  let catchup = 0;

  // 不限预算，按顺序把账处理完
  while (state.ledger.length > 0) {
    const row = state.ledger.shift();
    const event = row[0] === "add"
      ? { kind: "add", item: row[1] }
      : { kind: "seal" };
    applyEvent(input, state, event);
    catchup += 1;
  }

  return { state: state, catchup: catchup };
}
