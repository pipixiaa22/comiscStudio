import {pathKey} from '../../shared/lib/pathKey'

export function hydrateSources(items, project) {
    const sourceIdByPath = new Map((project.sources || []).map(source => [pathKey(source.path), source.id]))
    return items.map(item => ({...item, sourceId: sourceIdByPath.get(pathKey(item.path))}))
}

export function projectNameFromSource(source) {
    return source.name || source.directory.split(/[\\/]/).pop()
}
