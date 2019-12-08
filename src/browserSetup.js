const puppeteer = require('puppeteer')

module.exports = {
  setup
}

async function setup ({ headless = false, numWorkers = 0, userDataDir }) {
  console.log(`Lauching browser headless: ${headless} userDataDir: ${userDataDir}`)
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

// Wait for target expects a certain url, but we cannot pass in variabe values, as in page.evaluate
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
