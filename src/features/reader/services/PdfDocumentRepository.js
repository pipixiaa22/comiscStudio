import {mangaDeskBridge} from '../../../shared/bridge/mangaDeskBridge'

const documents = new Map()
let pdfjsPromise

function loadPdfjs() {
    if (!pdfjsPromise) {
        // PDF.js is only needed after a PDF is opened.  Loading it here keeps
        // the normal image/video workspace out of the initial renderer chunk.
        pdfjsPromise = Promise.all([
            import('pdfjs-dist'),
            import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        ]).then(([pdfjs, worker]) => {
            pdfjs.GlobalWorkerOptions.workerSrc = worker.default
            return pdfjs
        }).catch(error => {
            pdfjsPromise = null
            throw error
        })
    }
    return pdfjsPromise
}

export function getPdfDocument(file) {
    if (!documents.has(file)) {
        // The main process serves the file over studio-media:// with range
        // support, so PDF.js fetches only the bytes it needs instead of holding
        // the whole document in the renderer heap.
        const promise = Promise.all([loadPdfjs(), mangaDeskBridge.pdfUrl(file)])
            .then(([pdfjs, url]) => pdfjs.getDocument({url, disableRange: false, disableStream: false}).promise)
        documents.set(file, promise)
        promise.catch(() => documents.delete(file))
    }
    return documents.get(file)
}

export function retryPdfDocument(file) {
    releasePdfDocument(file)
}

export function releasePdfDocument(file) {
    const document = documents.get(file)
    documents.delete(file)
    document?.then(pdfDocument => pdfDocument.destroy?.()).catch(() => {
    })
}

export function releaseAllPdfDocuments() {
    [...documents.keys()].forEach(releasePdfDocument)
}
