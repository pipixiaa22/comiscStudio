import {useEffect, useRef, useState} from 'react'
import {getPdfDocument} from '../services/PdfDocumentRepository'

export function PageMedia({
                              item,
                              className = '',
                              scale = 0.3,
                              style,
                              priority = false,
                              onDimensions,
                              onState,
                              retry = 0
                          }) {
    const ref = useRef()
    const [visible, setVisible] = useState(priority || item.kind !== 'pdf-page')
    const [error, setError] = useState(false)
    useEffect(() => {
        setVisible(priority || item.kind !== 'pdf-page');
        setError(false)
    }, [item.path, priority, retry])
    useEffect(() => {
        if (item.kind !== 'pdf-page' || priority || visible || !ref.current || !window.IntersectionObserver) return
        const observer = new IntersectionObserver(entries => {
            if (entries[0]?.isIntersecting) {
                setVisible(true);
                observer.disconnect()
            }
        }, {rootMargin: '240px'})
        observer.observe(ref.current)
        return () => observer.disconnect()
    }, [item.kind, item.path, priority, visible])
    useEffect(() => {
        if (item.kind !== 'pdf-page' || !visible) return
        let cancelled = false;
        let renderTask
        setError(false);
        onState?.('loading')
        getPdfDocument(item.pdfPath).then(document => document.getPage(item.pageNumber)).then(pdfPage => {
            if (cancelled || !ref.current) return
            const base = pdfPage.getViewport({scale: 1});
            const viewport = pdfPage.getViewport({scale})
            onDimensions?.({width: base.width, height: base.height})
            const canvas = ref.current
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height)
            renderTask = pdfPage.render({canvas, canvasContext: canvas.getContext('2d', {alpha: false}), viewport})
            return renderTask.promise
        }).then(() => {
            if (!cancelled) onState?.('ready')
        }).catch(error => {
            if (!cancelled && error?.name !== 'RenderingCancelledException') {
                setError(true);
                onState?.('error')
            }
        })
        return () => {
            cancelled = true;
            renderTask?.cancel()
        }
    }, [item.kind, item.pdfPath, item.pageNumber, visible, scale, retry])
    if (item.kind !== 'pdf-page') return <img data-page-media src={item.url} className={className} style={style}
                                              onLoad={event => onDimensions?.({
                                                  width: event.currentTarget.naturalWidth,
                                                  height: event.currentTarget.naturalHeight
                                              })}/>
    return error ?
        <div data-page-media className={`${className} grid place-items-center bg-slate-900 text-xs text-red-300`}
             style={style}>PDF 页面加载失败</div> :
        <canvas ref={ref} data-page-media className={className} style={style}/>
}
