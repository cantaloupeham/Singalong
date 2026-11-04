const DB_NAME = 'yuni-chorus-songs'
const STORE = 'songs'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact(mode, action) {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = action(transaction.objectStore(STORE))
      let result
      request.onsuccess = () => { result = request.result }
      request.onerror = () => reject(request.error)
      transaction.onabort = () => reject(transaction.error)
      transaction.oncomplete = () => resolve(result)
    })
  } finally { db.close() }
}

export const listSavedSongs = () => transact('readonly', (store) => store.getAll())
export const getSavedSong = (key) => transact('readonly', (store) => store.get(key))
export const saveSong = (entry) => transact('readwrite', (store) => store.put(entry))
export const deleteSavedSong = (key) => transact('readwrite', (store) => store.delete(key))
