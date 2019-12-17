
const sleep = require('./sleep')

describe('sleep', () => {
  test('simple', async () => {
    const start = +new Date()
    await sleep(100)
    const elapsed = +new Date() - start
    expectInRange(elapsed, 100, 10)
  })

  function expectInRange (value, expected, range) {
    expect(range).toBeGreaterThanOrEqual(0)
    expect(value).toBeGreaterThanOrEqual(expected - range)
    expect(value).toBeLessThan(expected + range)
  }

  test('default value', async () => {
    const v = await sleep(1)
    expect(v).toEqual(1)
  })

  test('explicit value - number', async () => {
    const v = await sleep(1, 42)
    expect(v).toEqual(42)
  })

  test('explicit value - object', async () => {
    const v = await sleep(1, { answer: 42 })
    expect(v).toEqual({ answer: 42 })
  })

  test('explicit value - 0', async () => {
    const v = await sleep(1, 0)
    expect(v).toEqual(0)
  })
  test('explicit value - false', async () => {
    const v = await sleep(1, false)
    expect(v).toEqual(false)
  })
})
