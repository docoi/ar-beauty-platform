import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/Dashboard'
import ProfilePage from './pages/Profile'
import SupportPage from './pages/Support'
import VStudio from './pages/VStudio'
import PricingPage from './pages/Pricing'
import ContactPage from './pages/Contact'
import TryOnPage from './pages/TryOn'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/vstudio" element={<VStudio />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/try-on/:id" element={<TryOnPage />} />
      </Routes>
    </Router>
  )
}

export default App
