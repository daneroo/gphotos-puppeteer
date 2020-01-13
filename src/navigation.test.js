const { baseURL, navToEnd, enterDetailPage, currentActiveElement } = require('./navigation')
const perf = require('./perf')
const sleep = require('./sleep')

describe.skip('integration', () => {
  describe('navigation', () => {
    test('', async () => {
      const getMeAGooglePhotosPage = () => {}
      const h2id = (href) => href.split('/').slice(-1)[0]

      const page = getMeAGooglePhotosPage()

      await page.goto(baseURL, { waitUntil: ['load'] })
      const { first, last } = await navToEnd(page)
      console.log(h2id(first), h2id(last))

      let start = perf.now()
      await enterDetailPage(page, last)
      console.log(`selected last->last took ${perf.since(start)}ms ${page.url()}`)

      start = perf.now()
      await enterDetailPage(page, last)
      console.log(`last->last took ${perf.since(start)}ms ${page.url()}`)

      start = perf.now()
      await enterDetailPage(page, first)
      console.log(`last->first took ${perf.since(start)}ms ${page.url()}`)

      // This might be flaky: Escape from first, and select
      start = perf.now()
      await page.keyboard.press('Escape')
      await sleep(1500)
      await page.keyboard.press('ArrowLeft')
      await sleep(1500)
      console.log(`esc(first) took ${perf.since(start)}ms ${page.url()} and selected:${await currentActiveElement(page)}`)
      // to observe
      await sleep(3500)

      start = perf.now()
      await enterDetailPage(page, first)
      console.log(`selected first->first took ${perf.since(start)}ms ${page.url()}`)

      expect(true).toBe(true)
    })
  })
})
