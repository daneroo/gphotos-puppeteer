
const { unAuthenticatedUser, launchBrowser, moveAnonymousDataDir } = require('./browserSetup')
const { authenticate, getUsers } = require('./authenticate')

module.exports = {
  command: 'auth',
  describe: 'validate all users or add (replace) a userId',
  builder: (yargs) => {
    yargs
      .options({
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
  const { add, basePath, headless, verbose, progress } = argv

  // console.info('Auth Command', { argv })
  console.info('Auth Command', JSON.stringify({ add, headless, verbose, progress }))
  // validate?

  const users = []
  if (add) {
    console.info('Auth: adding (replacing) a user')
    users.push(unAuthenticatedUser)
  } else {
    console.info('Auth: Validating all users')
    users.push(...await getUsers({ basePath }))
  }

  for (const user of users) {
    const runAfterBrowserClose = [() => { console.log(`Running finalizers for ${user}`) }]
    console.log(`\n-Auth: ${user}`)

    const { browser, mainPage, userDataDir } = await launchBrowser({
      basePath,
      userId: user,
      headless: (add) ? false : headless,
      forceNewDataDir: add // if add, newDataDir, else Not
    })

    try {
      const { name, userId } = await authenticate(mainPage, { interactive: add })
      if (!userId) {
        console.log(`Authentication failed for ${user}`)
      // yargs.showHelp()
      } else {
        console.log(`Authenticated as ${name} (${userId || ''})`)
        if (user !== userId) {
          console.log(`Warning mismatched userId:${userId} and${userDataDir}`)
        }
        if (add) {
          runAfterBrowserClose.push(async () => {
            await moveAnonymousDataDir({ basePath, userId })
          })
        }
      }
    } catch (err) {
      console.error(err)
    }
    // console.log('Closing browser')
    await browser.close()
    for (const func of runAfterBrowserClose) {
      await func()
    }
  }
}
