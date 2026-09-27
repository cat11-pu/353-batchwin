// batch.js：满窗判定与封批
export function ready(window, cap) {
  return Array.isArray(window)
    && Number.isInteger(cap) && cap > 0
    && window.length >= cap;
}

export function packOf(window, batches) {
  const next = (Array.isArray(batches) ? batches : []).map(function (row) {
    return [row[0], Array.isArray(row[1]) ? row[1].slice() : []];
  });
  next.push([next.length + 1, Array.isArray(window) ? window.slice() : []]);
  return next;
}
