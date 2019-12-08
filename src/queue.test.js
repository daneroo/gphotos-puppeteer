
const { newQueue } = require('./queue.js')
const sleep = require('./sleep')

describe('Queue', () => {
  test('create an empty queue', () => {
    expect(newQueue()).toEqual({
      items: [],
      inFlight: [],
      results: [],
      doneFetching: false,
      doneProcessing: false
    })
  })
})

// Just the basics of race - no error/rejections
describe('test Promise.race - completion value', () => {
  test('order asc', async () => {
    const queue = [sleep(100), sleep(200)]
    const completed = await Promise.race(queue)
    expect(completed).toEqual(100)
    await Promise.all(queue)
  })
  test('order desc', async () => {
    const queue = [sleep(200), sleep(100)]
    const completed = await Promise.race(queue)
    expect(completed).toEqual(100)
    await Promise.all(queue)
  })
})

describe('test Promise.race - completion wrapper', () => {
  test('order asc', async () => {
    const queue = [sleep(100), sleep(200)]
    const [completed] = await Promise.race(queue.map(p => p.then(res => [p])))
    expect(completed).toBe(queue[0])
    await Promise.all(queue)
  })
  test('order desc', async () => {
    const queue = [sleep(200), sleep(100)]
    const [completed] = await Promise.race(queue.map(p => p.then(res => [p])))
    expect(completed).toBe(queue[1])
    await Promise.all(queue)
  })
})
