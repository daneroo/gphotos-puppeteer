const puppeteer = require('puppeteer')
const fsPromises = require('fs').promises
const path = require('path')
const baseURL = 'https://photos.google.com/'
const unAuthenticatedUser = 'anonymous'
const basePathDefault = './data'

module.exports = {
  baseURL,
  unAuthenticatedUser,
  basePathDefault,
  launchBrowser,
  makeDirs,
  moveAnonymousDataDir,
  setup
}

// launchBrowser just wrap calls to makeDirs, and setup
async function launchBrowser ({ basePath = basePathDefault, userId = unAuthenticatedUser, headless = false, forceNewDataDir = false } = {}) {
  const { userDataDir, userDownloadDir } = await makeDirs({ basePath, userId, forceNewDataDir })
  const { browser, mainPage } = await setup({ headless, userDataDir, userDownloadDir })
  // console.log(`Launched browser headless:${headless} userDataDir:${userDataDir} userDownloadDir:${userDownloadDir}`)
  return {
    userDataDir,
    userDownloadDir,
    browser,
    mainPage
  }
}
// ${basePath}/${userId}/{user-data-dir|downloads}
async function makeDirs ({ basePath = basePathDefault, userId = unAuthenticatedUser, forceNewDataDir = false } = {}) {
  const paths = {
    userDataDir: path.join(basePath, userId, 'user-data-dir'),
    userDownloadDir: path.join(basePath, userId, 'downloads')
  }
  if (forceNewDataDir) {
    await fsPromises.rmdir(paths.userDataDir, { recursive: true })
      .then(() => {
        console.warn(`Removed user-data-dir:${paths.userDataDir}`)
      })
      .catch(err => {
        if (err.code !== 'ENOENT') { // ENOENT is fine thats what we're trying to do!
          console.warn(err)
        }
      })
  }
  for (const k in paths) {
    await fsPromises.mkdir(paths[k], { recursive: true })
    // console.log(`made path - ${k} : ${paths[k]}`)
  }
  return paths
}

async function moveAnonymousDataDir ({ basePath = basePathDefault, userId = unAuthenticatedUser } = {}) {
  if (userId === unAuthenticatedUser) {
    console.warn(`Auth: moving anonymous user-data-dir to itself: ${userId}`)
    return
  }
  console.log(`Auth: moving anonymous user-data-dir to ${userId}`)
  const oldDataDir = path.join(basePath, unAuthenticatedUser, 'user-data-dir')
  const userDataDir = path.join(basePath, userId, 'user-data-dir')
  await fsPromises.rmdir(userDataDir, { recursive: true })
    .then(() => {
      // console.warn(`Removed user-data-dir:${userDataDir} if it was present`)
    })
    .catch(err => {
      if (err.code !== 'ENOENT') { // ENOENT is fine thats what we're trying to do!
        console.warn(err)
      }
    })
  await fsPromises.mkdir(path.resolve(userDataDir, '..'), { recursive: true })
  await fsPromises.rename(oldDataDir, userDataDir)
  console.info(`Moved new user-data-dir to: ${userDataDir}`)
}

// Launches browser (headless option) and creates numWorker extra windows/tabs
async function setup ({ headless = false, numWorkers = 0, userDataDir, userDownloadDir }) {
  const browser = await puppeteer.launch({
    headless,
    userDataDir
  })
  const mainPage = await getFirst(browser)
  await mainPage._client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: userDownloadDir
  })

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
    throw new Error(`Browser should only have 1 window, found ${pages.length}!`)
  }
  const page = pages[0]

  const url = 'about:blank?id=main'
  await page.goto(url)

  return page
}

// pageInNewWindow launches a new tab/window
// it does so by invoking window.open from an existing page.
// Note: waitForTarget expects a certain fixed url, but we cannot pass in variable values, as in page.evaluate
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
