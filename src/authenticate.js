const fsPromises = require('fs').promises
const sleep = require('./sleep')
const { baseURL, unAuthenticatedUser } = require('./browserSetup')

module.exports = {
  unAuthenticatedUser,
  getUsers,
  authenticate
}

// basePath/{users}/user-data-dir | user !=anonymous
// TODO(daneroo): validate that user-data-dir is present?
async function getUsers ({ basePath } = {}) {
  return (await fsPromises.readdir(basePath, { withFileTypes: true }))
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => dirent.name !== unAuthenticatedUser)
    .map(dirent => dirent.name)
}
// authenticate
// on success ->returns the result of getActiveUser()=>{name,userId}
// on failure ->
//  if interactive -> waits forever for authentication
//  if !interactive -> return immediately
async function authenticate (page, { interactive = false } = {}) {
  await page.goto(baseURL)
  await sleep(1000) // wait for something else?
  // console.log(`..navigated to ${baseURL}`)
  // Until we are authenticated (wait forever)
  while (true) {
    const url = page.url()
    if (url === baseURL) {
      const activeUser = await getActiveUser(page)
      return activeUser
    }
    if (!interactive) {
      // throw new Error('Cannot await authentication in headless mode')
      // console.log('Cannot await authentication in headless mode')
      return {}
    }
    console.log('Awaiting auth..') // Current URL is ${url}.
    await sleep(2000)
  }
}

// TODO(daneroo): what if querySelector returns null...
// TODO(daneroo): aria-label may have different prefix text in other locales, better RegExp?
// return {name,userId} if found
// return {name:'Unknown',userId:null} if NOT found
async function getActiveUser (page) {
  // document.querySelector('a[href^="https://accounts.google.com/SignOutOptions"]').getAttribute('aria-label')
  // "Google Account: Daniel Lauzon
  // (daniel.lauzon@gmail.com)"
  // Alternate selector:
  const activeHrefJSHandle = await page.evaluateHandle(() => document.querySelector('a[href^="https://accounts.google.com/SignOutOptions"]').getAttribute('aria-label'))
  const activeUser = await activeHrefJSHandle.jsonValue()
  // const activeUser = `Google Account: Daniel Lauzon
  // (daniel.lauzon@gmail.com)`
  const re = /Google Account:\s+(.*[^\s])\s+\((.*)\)/
  const found = activeUser.match(re)
  const [, name, userId] = found
  if (found.length === 3) {
    return { name, userId }
  } else {
    return { name: 'Unknown', userId: null }
  }
}
