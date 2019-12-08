
module.exports = {
  newQueue
}

// Functionality:
// q = newQueue({fetcher,launcher})
// async fetcher():[items] will be called when items are needed
// - and these items will be added to items[] array
// - fetcher should signify that is has no more items by return an empty array.
// async launcher(item) is dispatch new work
// -  maintains assignment of new tasks to inFlight array
// - Promise.race is used to maintain a full inFlight[]

function newQueue ({ fetcher, laucher } = {}) {
  return {
    items: [],
    inFlight: [], // each assigned to on of the workers
    results: [],
    doneFetching: false,
    doneProcessing: false
  }
}
