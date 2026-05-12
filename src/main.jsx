import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import CegPage from './CegPage.jsx' // Importando sua página nova
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/cegs" element={<CegPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)