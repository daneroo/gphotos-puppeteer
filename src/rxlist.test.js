
const { Subject } = require('rxjs')
const { timeout, tap } = require('rxjs/operators')
const sleep = require('./sleep')

describe('RxList', () => {
  test('externalPage action pattern with timeout', async () => {
    let nextId = 0
    const subject = new Subject()// ** This variable is bound to the exposed backToPuppeteerXXX() callback

    const externalPageAction = async () => {
      nextId++
      if (nextId < 4) {
        await sleep(100)
      } else {
        await sleep(1000)
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
        timeout(500)
      )
      .subscribe({
        next: async (href) => { // can href be null?
        // propagate event chain!
          await externalPageAction()
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
