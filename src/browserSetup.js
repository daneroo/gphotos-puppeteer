const puppeteer = require('puppeteer')

module.exports = {
  setup
}

// Launches browser (headless option) and creates numWorker extra windows/tabs
async function setup ({ headless = false, numWorkers = 0, userDataDir, userDownloadDir }) {
  console.log(`Lauching browser headless:${headless} userDataDir:${userDataDir} userDownloadDir:${userDownloadDir}`)
  const browser = await puppeteer.launch({
    headless,
    userDataDir
  })
  const mainPage = await getFirst(browser)
  const workers = []

  for (let w = 0; w < numWorkers; w++) {
    const worker = await pageInNewWindow(browser, mainPage, w)
    workers.push(worker)
  }

  return {
    browser,
    mainPage,
    workers
  }
}

// getFirst: get the first page (window/tab) object from the browser
// assume but verify that the browser has a single page
async function getFirst (browser) {
  // const page = await browser.newPage()
  // return page
  const pages = await browser.pages()
  if (pages.length !== 1) {
    throw new Error(`Browser shoud only have 1 window, found ${pages.length}!`)
  }
  const page = pages[0]

  const url = 'about:blank?id=main'
  await page.goto(url)

  return page
}

// pageInNewWindow launches a new tab/window
// it does so by invoking window.open from an existing page.
// Note: waitForTarget expects a certain fixed url, but we cannot pass in variabe values, as in page.evaluate
//   so we open the new window at 'about:blank?id=new' and subsequently load `about:blank?id=${id}`
async function pageInNewWindow (browser, launchFromPage, id) {
  await showPages(browser, `Before making ${id}`, launchFromPage)

  await launchFromPage.evaluate((id) => window.open('about:blank?id=new', `Worker - ${id}`, 'width=640,height=400'), id)
  const newWindowTarget = await browser.waitForTarget(target => target.url() === 'about:blank?id=new')

  // return the page but make it's url unique first
  const page = await newWindowTarget.page()
  const url = `about:blank?id=${id}`
  await page.goto(url)

  console.log(`new page: ${await page.title()} ${await page.url()}`)

  await showPages(browser, `After making ${id}`, page)
  return {
    id,
    page
  }
}

async function showPages (browser, msg, page) {
  const pages = await browser.pages()
  console.log(`${msg}: ${pages.length} pages`)
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    console.log(`${page === p ? '=>' : '  '} ${i}: ${await p.title()} ${await p.url()} `)
  }
  console.log('-----------------------------------')
}
