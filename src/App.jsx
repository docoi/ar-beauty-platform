import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./pages/home.jsx";
import Login from "./pages/login.jsx";
import Dashboard from "./pages/dashboard.jsx";
import Profile from "./pages/profile.jsx";
import Support from "./pages/support.jsx";
import Vstudio from "./pages/vstudio.jsx";
import Pricing from "./pages/pricing.jsx";
import Contact from "./pages/contact.jsx";
import AuthForm from "./components/AuthForm.jsx";
import PrivacyPolicy from "./pages/privacy.jsx";
import TermsOfService from './pages/TermsOfService.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import AvatarSwitcher from './pages/AvatarSwitcher.jsx';
import HydrationSerumPage from './pages/hydration_serum';
import VirtualTryOnPage from './pages/VirtualTryOnPage';
import WebGPUDemo from './components/WebGPUDemo.jsx';
import LipstickMirror from './components/LipstickMirror';
import Mirror from './pages/mirror.jsx';




function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ComingSoon />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/support" element={<Support />} />
        <Route path="/vstudio" element={<Vstudio />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/auth" element={<AuthForm />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />   
        <Route path="/AvatarSwitcher" element={<AvatarSwitcher />} />  
        <Route path="/hydration_serum" element={<HydrationSerumPage />} /> 
        <Route path="/try-on" element={<VirtualTryOnPage />} /> 
        <Route path="/webgpu-test" element={<WebGPUDemo />} />  
        <Route path="/lipstick-mirror" element={<LipstickMirror />} />    
        <Route path="/mirror" element={<Mirror />} />

      </Routes>
    </Router>
  );
}

export default App;
