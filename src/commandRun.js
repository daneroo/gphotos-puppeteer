
const { launchBrowser, baseURL } = require('./browserSetup')
const { authenticate, getUsers } = require('./authenticate')

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
  const { mode, direction, basePath, headless, verbose, progress } = argv

  // console.info('Auth Command', { argv })
  console.info('Run Command', { mode, direction, headless, verbose, progress })

  for (const user of await getUsers({ basePath })) {
    console.log(`\n-Run: user:${user}`)

    const { browser, mainPage, userDownloadDir } = await launchBrowser({ basePath, userId: user, headless })

    try {
      const { name, userId } = await authenticate(mainPage)
      if (!userId) {
        console.log('Authentication failed')
        throw new Error('Authentication failed')
      }
      console.log(`Authenticated as ${name} (${userId || ''})`)

      for (let i = 0; i < 1; i++) {
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
}
