// batchrun.js：按处理预算处理并留账，收尾不限预算补账
import { ready, packOf } from "./batch.js";

function cloneState(state) {
  const source = state || {};
  return {
    window: (source.window || []).slice(),
    batches: (source.batches || []).map(function (row) {
      return [row[0], row[1].slice()];
    }),
    ledger: (source.ledger || []).map(function (entry) { return entry.slice(); }),
    applied: (source.applied || []).slice()
  };
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// 结构与项目号校验：不合法直接抛错（不进账、不花预算）。
function inspect(event, spec) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail(spec.event_error_code || "E_BAD_EVENT", "事件必须是对象");
  }
  if (event.kind === "add") {
    if (!isPositiveInteger(event.item)) {
      fail(spec.bad_item_code || "E_BAD_ITEM", "项目号必须是正整数");
    }
  } else if (event.kind !== "seal") {
    fail(spec.event_error_code || "E_BAD_EVENT", "事件类型只支持 add / seal");
  }
}

// 把一条已校验的事件落到窗口/批次上，返回是否产生了新处理。
function applyEvent(event, state, spec) {
  if (event.kind === "add") {
    if (state.window.indexOf(event.item) !== -1) {
      fail(spec.dup_code || "E_DUP_ITEM", "项目号已在窗口里");
    }
    if (ready(state.window, spec.cap)) {
      state.batches = packOf(state.window, state.batches);
      state.window = [];
    }
    state.window.push(event.item);
  } else {
    if (state.window.length === 0) {
      fail(spec.empty_code || "E_EMPTY", "窗口是空的不能封批");
    }
    state.batches = packOf(state.window, state.batches);
    state.window = [];
  }
}

function eventKey(event) {
  return event && event.id !== undefined && event.id !== null ? event.id : null;
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  const applied = state.applied;
  let budget = Number.isFinite(spec.budget) ? spec.budget : 0;
  let served = 0;
  let queued = 0;

  for (const event of events) {
    const key = eventKey(event);
    // 重放的已处理事件不再花预算、不再入账。
    if (key !== null && applied.indexOf(key) !== -1) continue;

    inspect(event, spec);

    if (budget > 0) {
      applyEvent(event, state, spec);
      budget -= 1;
      served += 1;
    } else {
      state.ledger.push(event.kind === "add" ? ["add", event.item] : ["seal"]);
      queued += 1;
    }
    if (key !== null) applied.push(key);
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (entry) { return entry.slice(); }),
    judged: served + queued,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;

  // 收尾不限预算，把账上的事件按加入顺序逐条补处理。
  while (state.ledger.length > 0) {
    const entry = state.ledger.shift();
    const event = entry[0] === "add" ? { kind: "add", item: entry[1] } : { kind: "seal" };
    applyEvent(event, state, spec);
    catchup += 1;
  }

  return { state: state, catchup: catchup };
}
