// Simple promise-based mutex so concurrent syncNow() calls coalesce into one.
// Usage:
//   const { waitFor, release } = acquireMutex();
//   await waitFor;          // blocks until previous holder releases
//   try { ... } finally { release(); }

let chain: Promise<void> = Promise.resolve();

export function acquireMutex(): { waitFor: Promise<void>; release: () => void } {
  let release!: () => void;
  const myLock = new Promise<void>((res) => {
    release = res;
  });

  // waitFor = promise that resolves when the current chain is done
  const waitFor = chain;

  // Extend the chain: next caller waits for both previous chain AND my lock
  chain = chain.then(() => myLock);

  return { waitFor, release };
}
