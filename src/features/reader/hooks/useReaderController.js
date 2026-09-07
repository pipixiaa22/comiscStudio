import {useMemo, useState} from 'react'

export function useReaderController({item, sources, fitMode, setFitMode, onSelect}) {
    const [active, setActive] = useState(item)
    const [pageInput, setPageInput] = useState(String(item.pageNumber || 1))
    const [pageError, setPageError] = useState('')
    const [manualScale, setManualScale] = useState(null)
    const pages = useMemo(() => active.kind === 'pdf-page' ? sources.filter(source => source.pdfPath === active.pdfPath) : sources, [active.kind, active.pdfPath, sources])
    const pageIndex = Math.max(0, pages.findIndex(source => source.path === active.path))
    const selectPage = index => {
        if (index < 0 || index >= pages.length) return false
        const next = pages[index]
        setActive(next);
        setPageInput(String(next.pageNumber || index + 1));
        setPageError('');
        onSelect(next)
        return true
    }
    const submitPage = () => {
        const page = Number(pageInput)
        if (!Number.isInteger(page) || page < 1 || page > pages.length) {
            setPageError(`请输入 1 到 ${pages.length} 的页码`);
            return false
        }
        return selectPage(page - 1)
    }
    const updatePageInput = value => {
        setPageInput(value);
        setPageError('')
    }
    const setFit = mode => {
        setManualScale(null);
        setFitMode(mode)
    }
    const zoom = (currentScale, factor) => {
        setManualScale(Math.max(0.25, Math.min(4, currentScale * factor)));
        setFitMode('manual')
    }
    return {
        active,
        pages,
        pageIndex,
        pageInput,
        pageError,
        manualScale,
        setPageInput: updatePageInput,
        selectPage,
        submitPage,
        setFit,
        zoom
    }
}
