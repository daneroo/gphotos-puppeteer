
const util = require('util')
const exec = util.promisify(require('child_process').exec)

// This is used to ensure serialized calling to pk-put.
const { Mutex } = require('async-mutex')

const rp = require('request-promise-native')

module.exports = {
  putLocked,
  put,
  exists,
  findGPhotoId
}

const searchURL = 'http://localhost:3179/my-search/camli/search/query'

// putLocked simply wraps `put` with a global mutex
const mutex = new Mutex()
async function putLocked (file, gphotoId) {
  const release = await mutex.acquire()
  try {
    await put(file, gphotoId)
  } finally {
    release()
  }
}

// Shells out to `pk-put`
// TODO(daneroo) could be replaced with a custom go binary - to avoid two calls, and two claims on the permanode
async function put (file, gphotoId) {
  if (await exists(gphotoId)) {
    // console.warn(`Put:gphotoId already exists ${gphotoId}`)
    return
  }
  const { stdout } = await exec(`pk-put file -exiftime -filenodes "${file}"`)
  // console.log('stdout:', stdout)
  // console.error('stderr:', stderr)
  const lines = stdout.split('\n')
  if (lines.length !== 4) {
    console.warn(`Put:Was expecting 4 lines (1 empty), found ${lines.length}`)
  }
  const permanode = lines[0]
  await exec(`pk-put attr "${permanode}" gphotoId "${gphotoId}"`)
  // console.log('stdout2:', stdout2)
  // console.error('stderr2:', stderr2)
}

// Thin wrapper over search below
async function exists (gphotoId) {
  // console.debug(`Checking existence of ${gphotoId}`)
  const srch = await findGPhotoId(gphotoId)
  // console.debug({ srch })
  const exists = srch.blobs && srch.blobs.length > 0
  // console.debug(`${gphotoId} exists? ${exists}`)
  return exists
}

// This calls the search API for our specific usage: find single gphotoId attribute
async function findGPhotoId (gphotoId) {
  // reverse enginered from the web ui search
  // I don't use application/x-www-form-urlencoded as they do, but it works this way.
  const qy = {
    // sort: '-created',
    expression: `attr:gphotoId:${gphotoId}`,
    describe: {
      depth: 0,
      rules: [
        { attrs: ['camliContent', 'camliContentImage'] }
      ]
    },
    limit: 50
  }
  // console.log(qy)
  return rp({
    method: 'POST',
    uri: searchURL,
    body: qy,
    json: true // Automatically stringifies the body to JSON
  })
}
