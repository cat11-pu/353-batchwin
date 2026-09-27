// batch.js：满窗判定与封批
export function ready(window, cap) {
  return Array.isArray(window) && window.length >= cap;
}

export function packOf(window, batches) {
  return batches.concat([[batches.length + 1, window.slice()]]);
}
