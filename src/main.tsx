import * as React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('#root 不存在：检查 index.html')
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
