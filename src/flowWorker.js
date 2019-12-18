const sleep = require('./sleep')

module.exports = {
  downloadItems
}

// doanloadItems is deprecated: was meant to coordinate work betweeen multiple worker/window/tabs.
async function downloadItems (workers, items, doneItems, userDownloadDir) {
  // TODO(daneroo): move this to setup...
  for (let w = 0; w < workers.length; w++) {
    const { id, page } = workers[w]
    console.log(`Downloading items with worker: ${id}`)
    await page._client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: userDownloadDir
    })
    console.log(`  set dlDir to: ${userDownloadDir}`)
  }
  await sleep(1000)
  while (items.length > 0) { // TODO(daneroo): Queue not done...
    const { id, page } = workers[items.length % workers.length]
    const item = items.shift() // take first item from items queue
    console.log(`Worker(${id}): Going to page: ${item}`)
    await page.goto(item)
    console.log(`Worker(${id}): Landed on page:${item}`)
    await page.keyboard.down('Shift')
    await page.keyboard.press('KeyD')
    await page.keyboard.up('Shift')
    await sleep(3000)
    doneItems.push(item)
  }
}
