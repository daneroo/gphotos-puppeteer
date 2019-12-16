// API for performance measurements
const { performance } = require('perf_hooks')

module.exports = {
  now,
  since,
  metrics,
  log
}

// now Returns the current high resolution millisecond timestamp, where 0 represents the start of the current node process
function now () {
  return performance.now()
}

// since returns a high resolution millisecond difference since <start>
function since (start) {
  return performance.now() - start
}

// rate() returns a common formatted string for timing measurements
function metrics (name, start, n) {
  const elapsed = since(start)
  const average = (n !== 0) ? elapsed / n : 0 // could be +Inf
  const averageSecs = average / 1000.0
  const rate = (averageSecs !== 0) ? 1.0 / averageSecs : 0 // could be +Inf
  return {
    name,
    start,
    n,
    elapsed, // duration
    average, // milliseconds per iteration
    rate // iterations per second
  }
}

function log (name, start, n) {
  const {
    elapsed, // duration
    average, // seconds per iteration
    rate // iterations per second
  } = metrics(name, start, n)
  if (n === 1) {
    console.log(`::${name}:: elapsed:${(elapsed / 1000.0).toFixed(4)}s`)
  } else {
    console.log(`::${name}:: rate:${rate.toFixed(2)}/s avg:${average.toFixed(2)}ms n:${n} elapsed:${(elapsed / 1000.0).toFixed(4)}s`)
  }
}
