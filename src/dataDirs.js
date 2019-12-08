const path = require('path')
const fsPromises = require('fs').promises

module.exports = {
  make
}

async function make (basePath = './data') {
  const paths = {
    userDataDir: path.join(basePath, 'user-data-dir'),
    userDownloadDir: path.join(basePath, 'downloads')
  }
  for (const k in paths) {
    await fsPromises.mkdir(paths[k], { recursive: true })
    console.log(`made path - ${k} : ${paths[k]}`)
  }

  return paths
}
