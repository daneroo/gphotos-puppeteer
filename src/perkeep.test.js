const perkeep = require('./perkeep')
const perf = require('./perf')

// Requires a disposable perkeep instance
// TODO(daneroo): point this at a docker instance
// TODO(daneroo): use a uuid, generate a zone plate + noise
describe.skip('Burn In - Destructive to perkeep', () => {
  test('pk-put, then test exixtence', async () => {
    const n = 2

    // use a uuid, generate a zone plate + noise
    const gphotoId = 'AF1QipMOl0XXrO9WPSv5muLRBFpbyzGsdnrqUqtF8f73'
    {
      const file = 'data/downloads/AF1QipMOl0XXrO9WPSv5muLRBFpbyzGsdnrqUqtF8f73/IMG_9489.JPG'
      const start = perf.now()
      for (let i = 0; i < n; i++) {
        await perkeep.put(file, gphotoId)
      }
      perf.log('Pu:file', start, n)
    }

    {
      const start = perf.now()
      for (let i = 0; i < n; i++) {
        await perkeep.exists(gphotoId)
      }
      perf.log('Search:gphotoId', start, n)
    }
  })
  test('search with result snapshot', async () => {
    // TODO(daneroo): synthetic image/gphotoId
    const gphotoId = 'AF1QipMOl0XXrO9WPSv5muLRBFpbyzGsdnrqUqtF8f73'
    const expected = {
      blobs: [
        {
          blob: 'sha224-1e2b15f401710f8515bb91e48fd1257cf8064526a455eccd07049553'
        }
      ],
      description: {
        meta: {
          'sha224-1e2b15f401710f8515bb91e48fd1257cf8064526a455eccd07049553': {
            blobRef: 'sha224-1e2b15f401710f8515bb91e48fd1257cf8064526a455eccd07049553',
            camliType: 'permanode',
            size: 651,
            permanode: {
              attr: {
                camliContent: [
                  'sha224-d3a163d9d71d0fae94b78f0ab20ca635d62de1959ba4fb48c0df3024'
                ],
                gphotoId: [
                  'AF1QipMOl0XXrO9WPSv5muLRBFpbyzGsdnrqUqtF8f73'
                ]
              },
              modtime: '2020-01-03T04:58:00.949178Z'
            }
          },
          'sha224-d3a163d9d71d0fae94b78f0ab20ca635d62de1959ba4fb48c0df3024': {
            blobRef: 'sha224-d3a163d9d71d0fae94b78f0ab20ca635d62de1959ba4fb48c0df3024',
            camliType: 'file',
            size: 415,
            file: {
              fileName: 'IMG_9489.JPG',
              size: 104358,
              mimeType: 'image/jpeg',
              time: '2010-08-03T20:25:01Z',
              modTime: '2010-08-03T20:25:01Z',
              wholeRef: 'sha224-660d2b0ce843e045df5c78ac2c2a64eb8ffe69f3679f5e1e817389e3'
            },
            image: {
              width: 1024,
              height: 683
            }
          }
        }
      },
      LocationArea: null
    }
    const resp = await perkeep.findGPhotoId(gphotoId)
    // console.log(JSON.stringify(resp, null, 2))
    expect(resp).toEqual(expected)
  })
})
