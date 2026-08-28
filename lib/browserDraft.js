function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("kaarya-intake-transfer", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function saveIntakeTransfer(form) {
  const db = await database();
  try { await new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put({ form, expires: Date.now() + 30 * 60 * 1000 }, "oauth");
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
export async function takeIntakeTransfer() {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite"); const store = tx.objectStore("drafts");
    const request = store.get("oauth"); let record;
    request.onsuccess = () => { record = request.result; store.delete("oauth"); };
    tx.oncomplete = () => resolve(record?.expires > Date.now() ? record.form : null); tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
