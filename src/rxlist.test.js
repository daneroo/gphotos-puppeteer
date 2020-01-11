
const { Subject } = require('rxjs')
const { timeout, tap } = require('rxjs/operators')
const { oneLoopUntilTimeout, nLoopsUntilConsecutiveZeroCounts } = require('./rxlist')
const sleep = require('./sleep')

describe('RxList', () => {
  test.each([
    [0, [0]],
    [1, [0, 2]],
    [2, [0, 2, 5]],
    [3, [0, 2, 5, 9]]
  ])('nLoopsUntilConsecutiveZeroCounts maxCZC:%i', async (maxConsecutiveZeroCounts, expected) => {
    const maxDelay = 10
    const subject = new Subject()// ** This variable is bound to the exposed backToPuppeteerXXX() callback
    const items = []
    async function onItem (href) {
      // await sleep(maxDelay / 4)
      items.push(href)
    }

    const snd = true
    const skp = false
    const sendOrSkip = [snd, skp, snd, skp, skp, snd, skp, skp, skp, snd, skp, skp, skp, skp]

    let nextId = -1
    const onNext = async () => {
      nextId++
      const send = sendOrSkip[nextId % sendOrSkip.length]
      if (send) {
        await sleep(maxDelay / 2)
        subject.next(nextId)
      }
    }

    const onLoop = (extra) => { }
    await nLoopsUntilConsecutiveZeroCounts(maxConsecutiveZeroCounts, maxDelay, subject, onItem, onNext, onLoop)

    // expect(items).toEqual([0])
    // expect(items).toEqual([0, 2])
    // expect(items).toEqual([0, 2, 5])
    expect(items).toEqual(expected)
  })
  test('oneLoopUntilTimeout (with async onItem)', async () => {
    const maxDelay = 10
    const subject = new Subject()// ** This variable is bound to the exposed backToPuppeteerXXX() callback
    const items = []
    async function onItem (href) {
      await sleep(maxDelay / 4)
      items.push(href)
    }
    const s = maxDelay / 2
    const b = maxDelay * 2
    const delays = [s, s, s, b]
    let nextId = 0
    const onNext = async () => {
      const d = delays[nextId % delays.length]
      await sleep(d)
      nextId++
      subject.next(nextId)
    }
    await oneLoopUntilTimeout(maxDelay, subject, onItem, onNext)
    expect(items).toEqual([1, 2, 3])
  })
  test('oneLoopUntilTimeout', async () => {
    let nextId = 0
    const maxDelay = 10
    const subject = new Subject()// ** This variable is bound to the exposed backToPuppeteerXXX() callback
    const items = []
    function onItem (href) {
      items.push(href)
    }
    const onNext = async () => {
      nextId++
      if (nextId < 4) {
        await sleep(maxDelay / 2)
      } else {
        await sleep(maxDelay * 2)
      }
      subject.next(nextId)
    }
    await oneLoopUntilTimeout(maxDelay, subject, onItem, onNext)
    expect(items).toEqual([1, 2, 3])
  })
  test('externalPage action pattern with timeout', async () => {
    let nextId = 0
    const maxDelay = 10
    const subject = new Subject()// ** This variable is bound to the exposed backToPuppeteerXXX() callback

    const externalPageAction = async () => {
      nextId++
      if (nextId < 4) {
        await sleep(maxDelay / 2)
      } else {
        await sleep(maxDelay * 2)
      }
      subject.next(nextId)
    }
    let resolver
    const p = new Promise((resolve) => {
      resolver = resolve
    })

    const items = []

    subject
      .pipe(
        tap(href => { // accumutate items as a side effect
          items.push(href)
        }),
        timeout(maxDelay)
      )
      .subscribe({
        next: async (href) => { // can href be null?
          await externalPageAction() // propagate event chain!
        },
        error: async (e) => { // timeout
          resolver() // can only be timeout,so we are done
        }
      })
    await externalPageAction()
    await p // resoved on timeout
    expect(items).toEqual([1, 2, 3])
  })
})
