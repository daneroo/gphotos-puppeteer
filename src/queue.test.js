
const { newQueue, assign } = require('./queue.js')
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
  test('assign none to the consumer', async () => {
    const q = {
      items: [],
      inFlight: [null, null, null]
    }
    const consumer = async (item) => {
      await sleep(10)
      console.log(`setup ${item}`)
      return async function () {
        // console.log(`task start ${item}`)
        await sleep(20)
        // console.log(`task ${item}`)
      }
    }
    const assigned = await assign(q, consumer)
    expect(assigned).toBe(0)
    await Promise.all(q.inFlight)
  })
  test('assign all to the consumer', async () => {
    const q = {
      items: ['a', 'b', 'c'],
      inFlight: [null, null, null]
    }
    const consumer = async (item) => {
      await sleep(10)
      // console.log(`setup ${item}`)
      return async function () {
        // console.log(`task start ${item}`)
        await sleep(20)
        // console.log(`task ${item}`)
      }
    }
    const assigned = await assign(q, consumer)
    expect(assigned).toBe(3)
    await Promise.all(q.inFlight)
  })
  test('assign one to the consumer', async () => {
    const q = {
      items: ['a', 'b', 'c'],
      inFlight: ['assigned', null, 'assigned']
    }
    const consumer = async (item) => {
      await sleep(10)
      // console.log(`setup ${item}`)
      return async function () {
        // console.log(`task start ${item}`)
        await sleep(20)
        // console.log(`task ${item}`)
      }
    }
    const assigned = await assign(q, consumer)
    expect(assigned).toBe(1)
    await Promise.all(q.inFlight)
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
