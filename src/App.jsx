import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "@/pages/home.jsx";
import Login from "@/pages/login.jsx";
import Dashboard from "@/pages/dashboard.jsx";
import Profile from "@/pages/profile.jsx";
import Support from "@/pages/support.jsx";
import Pricing from "@/pages/pricing.jsx";
import Contact from "@/pages/contact.jsx";
import PrivacyPolicy from "@/pages/privacy.jsx";
import TermsOfService from "@/pages/TermsOfService.jsx";
import AvatarSwitcher from "@/pages/AvatarSwitcher.jsx";
import ComingSoonPage from "@/pages/ComingSoon.jsx";
import HydrationSerumPage from "@/pages/hydration_serum.jsx";
import VirtualTryOnPage from "@/pages/VirtualTryOnPage.jsx";
import TestWebGPUCanvas from './components/TestWebGPUCanvas'; // Import the new test component



// ✅ FIXED: Use correct path to component
import WebGPUDemo from "@/components/WebGPUDemo.jsx";
import WebGPUTest from '@/pages/webgpu-test.jsx';
import StaticSafeTryOn from "@/components/StaticSelfieTryOn.jsx";
import TryOnRenderer from "@/components/TryOnRenderer.jsx";
import LipstickMirror from "@/components/LipstickMirror.jsx";
import LipstickMirrorLive from "@/pages/LipstickMirrorLive.jsx";
import MirrorPage from "@/pages/mirror.jsx";

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
        <Route path="/webgpu-test" element={<WebGPUDemo />} />
        <Route path="/lipstick-mirror" element={<LipstickMirror />} />
        <Route path="/mirror" element={<MirrorPage />} />
        <Route path="/mirror-live" element={<LipstickMirrorLive />} />
      </Routes>
    </Router>
  );
}

export default App;
