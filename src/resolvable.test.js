
const resolvable = require('./resolvable')

describe('resolvable', () => {
  test('resolvable', async () => {
    const { promise, resolver } = resolvable()
    setTimeout(resolver, 100)
    const value = await promise
    expect(value).toBeUndefined()
  })
  test('resolvable with value', async () => {
    const expected = 42
    const { resolver, promise } = resolvable()
    setTimeout(() => { resolver(expected) }, 100)
    const value = await promise
    expect(value).toEqual(expected)
  })
})
