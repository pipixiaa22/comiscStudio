import {Component} from 'react'
import {createRoot} from 'react-dom/client'
import App from './App'
import {CapCutAssistant} from './features/capcut/components/CapCutAssistant'
import {ProjectStoreProvider} from './store/ProjectStoreProvider'
import './index.css'

class RootErrorBoundary extends Component {
    constructor(props) { super(props); this.state = {error: null} }
    static getDerivedStateFromError(error) { return {error} }
    render() { return this.state.error ? <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground"><div><b>界面启动失败</b><p className="mt-2 text-sm text-muted-foreground">{this.state.error.message || '请重启应用后重试'}</p></div></main> : this.props.children }
}
const root = createRoot(document.getElementById('root'))
root.render(<RootErrorBoundary>{location.hash === '#/capcut' ? <CapCutAssistant/> : <ProjectStoreProvider><App/></ProjectStoreProvider>}</RootErrorBoundary>)
