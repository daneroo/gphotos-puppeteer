
const { Subject } = require('rxjs')
const { timeout, tap } = require('rxjs/operators')
const { oneLoopUntilTimeout } = require('./rxlist')
const sleep = require('./sleep')

describe('RxList', () => {
  test('oneLoopUntilTimeout', async () => {
    let nextId = 0
    const maxDelay = 10
    const subject = new Subject()// ** This variable is bound to the exposed backToPuppeteerXXX() callback
    const items = []
    function syncUpdate (href) {
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
    await oneLoopUntilTimeout(maxDelay, subject, syncUpdate, onNext)
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
