import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import CegPage from './CegPage.jsx' // Importando sua página nova
import './index.css'
import AlbumWishlistPage from './AlbumWishlistPage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/cegs" element={<CegPage />} />
        <Route path="/album-wishlist" element={<AlbumWishlistPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)