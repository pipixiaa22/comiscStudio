import { createRoot } from 'react-dom/client'
import App from './App'
import { ProjectStoreProvider } from './store/ProjectStoreProvider'
import './index.css'
createRoot(document.getElementById('root')).render(<ProjectStoreProvider><App /></ProjectStoreProvider>)
