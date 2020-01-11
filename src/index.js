const { authenticate } = require('./authenticate')
const browserSetup = require('./browserSetup')
const sleep = require('./sleep')
// const { navToFirstDetailPage, loopDetailPages, modes } = require('./flow')
const { listMain } = require('./rxlist')

main()
  .catch(err => {
    console.error(err)
  })

async function main () {
  const headless = true
  const numWorkers = 0
  const { userDataDir, userDownloadDir } = await browserSetup.makeDirs('./data')
  const { browser, mainPage/*, workers */ } = await browserSetup.setup({
    headless,
    numWorkers,
    userDataDir,
    userDownloadDir
  })
  // console.log(`Found ${workers.length} workers`)

  try {
    // browser.on('targetchanged', t => {
    //   console.log(`>> target change: ${t.url()}`)
    // })

    await authenticate(mainPage)
    await sleep(1000)
    // throw new Error('Early')

    for (let i = 0; i < 1; i++) {
      await listMain(mainPage, 'ArrowRight')
      await listMain(mainPage, 'ArrowLeft')
      await mainPage.reload({ waitUntil: ['load'] }) // about 3s
    }
    // const url = await navToFirstDetailPage(mainPage)
    // console.log(`FirstPhoto (Detail Page): (url:${url})`)
    // // await sleep(500) // why ?
    // await loopDetailPages(mainPage, userDownloadDir, modes.files)

    await sleep(3000)
  } catch (err) {
    console.error(err)
  }

  console.log('Closing browser')
  await browser.close()
}
