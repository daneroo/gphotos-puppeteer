
const yargs = require('yargs')
const browserSetup = require('../browserSetup')
const { authenticate } = require('../authenticate')

module.exports = {
  command: 'auth',
  describe: 'validate all users or add (replace) a userid',
  builder: (yargs) => {
    yargs
      .options({ // new default: false
        // headless: {
        //   default: false,
        //   type: 'boolean'
        // },
        add: {
          alias: 'a',
          default: false,
          describe: 'Add (replace) a user',
          type: 'boolean'
        }
      })
  },
  handler
}

async function handler (argv) {
  const { add, headless, verbose, progress } = argv

  // console.info('Auth Command', { argv })
  console.info('Auth Command', { add, headless, verbose, progress })
  // validate?

  if (add) {
    console.info('Auth: adding (replacing) a user')
  } else {
    console.info('Auth: Validating all users')
  }

  const { userDataDir, userDownloadDir } = await browserSetup.makeDirs({
    basePath: './data',
    forceNewDataDir: add // if add, newDataDir, else Not
  })
  const { browser, mainPage/*, workers */ } = await browserSetup.setup({
    headless: (add) ? false : headless,
    userDataDir,
    userDownloadDir
  })

  try {
    const { name, userId } = await authenticate(mainPage, (add) ? false : headless)
    if (!userId) {
      console.log('Authentication failed')
      console.error('Did you want to add or replace a user? (--add)')
      yargs.showHelp()
    } else {
      console.log(`Authenticated as ${name} (${userId || ''})`)
    }
  } catch (err) {
    console.error(err)
  }
  console.log('Closing browser')
  await browser.close()
}
