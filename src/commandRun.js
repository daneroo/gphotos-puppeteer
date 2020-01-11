
const browserSetup = require('./browserSetup')
const { authenticate, baseURL } = require('./authenticate')
const { listDetail, listAlbum } = require('./rxlist')
const { navToFirstDetailPage, loopDetailPages, modeNames } = require('./flow')

module.exports = {
  command: 'run',
  describe: 'Iterate through all photos, and download as appropriate',
  builder: (yargs) => {
    yargs
      .options({ // new default: false
        mode: {
          alias: 'm',
          default: 'list',
          describe: 'which mode to use while traversing items',
          choices: ['listAlbum', 'listDetail', ...modeNames()]
        },
        direction: {
          alias: 'd',
          default: 'ArrowRight',
          describe: 'which direction to use while traversing items',
          choices: ['ArrowRight', 'ArrowLeft']
        }
      })
  },
  handler
}

async function handler (argv) {
  const { mode, direction, headless, verbose, progress } = argv

  // console.info('Auth Command', { argv })
  console.info('Run Command', { mode, direction, headless, verbose, progress })

  const { userDataDir, userDownloadDir } = await browserSetup.makeDirs({ basePath: './data' })
  const { browser, mainPage/*, workers */ } = await browserSetup.setup({
    headless,
    userDataDir,
    userDownloadDir
  })

  try {
    const { name, userId } = await authenticate(mainPage, headless)
    if (!userId) {
      console.log('Authentication failed')
      throw new Error('Authentication failed')
    }
    console.log(`Authenticated as ${name} (${userId || ''})`)

    for (let i = 0; i < 2; i++) {
      if (mode === 'listAlbum') {
        await mainPage.reload({ waitUntil: ['load'] })
        await listAlbum(mainPage, direction)
      } else if (mode === 'listDetail') {
        // const last = 'https://photos.google.com/photo/AF1QipPH5vnIJzbiPCXCNxtE3ZmpUJLeHL4VTmrcM57J'
        // await mainPage.goto(last, { waitUntil: ['load'] })
        // console.log(`LastPhotoPhoto (Detail Page): (url:${last})`)
        await mainPage.goto(baseURL, { waitUntil: ['load'] })
        const url = await navToFirstDetailPage(mainPage)
        console.log(`FirstPhoto (Detail Page): (url:${url})`)
        await listDetail(mainPage, direction)
      } else {
        await mainPage.goto(baseURL, { waitUntil: ['load'] })
        const url = await navToFirstDetailPage(mainPage)
        console.log(`FirstPhoto (Detail Page): (url:${url})`)
        await loopDetailPages(mainPage, userDownloadDir, mode)
      }
    }
  } catch (err) {
    console.error(err)
  }
  console.log('Closing browser')
  await browser.close()
}
