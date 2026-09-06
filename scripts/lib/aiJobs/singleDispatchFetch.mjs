export function singleDispatchFetch(baseFetch) {
  let dispatched = false;
  return (...args) => {
    if (dispatched) throw new Error('Job provider transport retry blocked; explicit retry is required');
    dispatched = true;
    return baseFetch(...args);
  };
}
