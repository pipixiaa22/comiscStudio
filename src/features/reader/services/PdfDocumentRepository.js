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
        // PDF.js only issues Range requests when the document URL is http(s);
        // for any other scheme it falls back to XHR without a Range header, so a
        // custom protocol cannot stream a PDF.  The bytes therefore come over IPC.
        const promise = Promise.all([loadPdfjs(), mangaDeskBridge.readPdf(file)])
            .then(([pdfjs, data]) => pdfjs.getDocument({data: data instanceof Uint8Array ? data : new Uint8Array(data)}).promise)
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
