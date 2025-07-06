// src/App.jsx

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Standard Pages
import Home from "@/pages/home.jsx";
import Login from "@/pages/login.jsx";
import Dashboard from "@/pages/dashboard.jsx";
import Profile from "@/pages/profile.jsx";
import Support from "@/pages/support.jsx";
import Pricing from "@/pages/pricing.jsx";
import Contact from "@/pages/contact.jsx";
import PrivacyPolicy from "@/pages/privacy.jsx";
import TermsOfService from "@/pages/TermsOfService.jsx";
import ComingSoonPage from "@/pages/ComingSoon.jsx";

// Feature Pages
import AvatarSwitcher from "@/pages/AvatarSwitcher.jsx";
import HydrationSerumPage from "@/pages/hydration_serum.jsx";
import VirtualTryOnPage from "@/pages/VirtualTryOnPage.jsx";

// CORRECT: We import our component from its correct home in the 'components' folder.
import LipstickMirrorLive_Clone from '@/components/LipstickMirrorLive_Clone';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ComingSoonPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/support" element={<Support />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/avatar-switcher" element={<AvatarSwitcher />} />
        <Route path="/hydration_serum" element={<HydrationSerumPage />} />
        <Route path="/try-on" element={<VirtualTryOnPage />} />
        
        {/* CORRECT: This line creates the URL and tells it what component to show. */}
        <Route path="/mirror-live" element={<LipstickMirrorLive_Clone />} />

      </Routes>
    </Router>
  );
}

export default App;