const perf = require('./perf')

describe('perf vs Date()', () => {
  test('`+new Date()` Slower than `perf.now()`', async () => {
    const iterations = 100

    let ignoredStart

    const start1 = perf.now()
    for (let i = 0; i < iterations; i++) {
      ignoredStart = +new Date() // the operation under test
    }
    const dateElapsed = perf.since(start1)

    const start2 = perf.now()
    for (let i = 0; i < iterations; i++) {
      ignoredStart = perf.now() // the operation under test
    }
    const perfElapsed = perf.since(start2)

    // console.log({ dateElapsed, perfElapsed })
    expect(ignoredStart).toBeGreaterThan(0) // for linter
    expect(dateElapsed).toBeGreaterThanOrEqual(perfElapsed)
  })
  test('`+new Date()-start` Slower than `perf.now()-start`', async () => {
    const iterations = 100

    let ignoredStart = +new Date()
    let ignoredElapsed

    const start1 = perf.now()
    for (let i = 0; i < iterations; i++) {
      ignoredElapsed = +new Date() - ignoredStart // the operation under test
    }
    const dateElapsed = perf.since(start1)

    ignoredStart = perf.now()
    const start2 = perf.now()
    for (let i = 0; i < iterations; i++) {
      ignoredElapsed = perf.now() - ignoredStart // the operation under test
    }
    const perfElapsed = perf.since(start2)

    // console.log({ dateElapsed, perfElapsed })
    expect(ignoredElapsed).toBeGreaterThan(0) // for linter
    expect(dateElapsed).toBeGreaterThanOrEqual(perfElapsed)
  })

  // this is unexpected because there is an extra function call in .since()
  test('`perf.now()-start` Slower than `perf.since(start)`', async () => {
    const iterations = 100

    let ignoredStart = +new Date()
    let ignoredElapsed

    const start1 = perf.now()
    for (let i = 0; i < iterations; i++) {
      ignoredElapsed = perf.now() - ignoredStart // the operation under test
    }
    const nowMinusStartElapsed = perf.since(start1)

    ignoredStart = perf.now()
    const start2 = perf.now()
    for (let i = 0; i < iterations; i++) {
      ignoredElapsed = perf.since(ignoredStart) // the operation under test
    }
    const sinceElapsed = perf.since(start2)

    // console.log({ nowMinusStartElapsed, sinceElapsed })
    expect(ignoredElapsed).toBeGreaterThan(0) // for linter
    expect(nowMinusStartElapsed).toBeGreaterThanOrEqual(sinceElapsed)
  })
})
