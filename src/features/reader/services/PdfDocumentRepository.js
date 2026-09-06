import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { mangaDeskBridge } from '../../../shared/bridge/mangaDeskBridge'

GlobalWorkerOptions.workerSrc = pdfWorker
const documents = new Map()

export function getPdfDocument(file) {
  if (!documents.has(file)) {
    const promise = mangaDeskBridge.readPdf(file).then(data => getDocument({ data: data instanceof Uint8Array ? data : new Uint8Array(data) }).promise)
    documents.set(file, promise)
    promise.catch(() => documents.delete(file))
  }
  return documents.get(file)
}
export function retryPdfDocument(file) { releasePdfDocument(file) }
export function releasePdfDocument(file) {
  const document = documents.get(file)
  documents.delete(file)
  document?.then(pdfDocument => pdfDocument.destroy?.()).catch(() => {})
}
export function releaseAllPdfDocuments() { [...documents.keys()].forEach(releasePdfDocument) }
