// Filename: AuthForm.jsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { supabase } from '../../utils/supabaseClient';
import { Camera } from '@mediapipe/camera_utils'; // ✅ Make sure this is installed

const AuthForm = () => {
  const videoRef = useRef(null); // ✅ Needed for MediaPipe
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!videoRef.current) return;

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        console.log('📸 Capturing frame from login screen webcam...');
      },
      width: 640,
      height: 480,
    });

    camera.start();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else {
      console.log('✅ Login success:', data);
      navigate("/dashboard");
    }
  };

  const handleGoogleLogin = async () => {
    const isLocalhost = window.location.hostname === 'localhost';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: isLocalhost
          ? 'http://localhost:5173/dashboard'
          : 'https://vtryit.com/dashboard',
      },
    });

    if (error) console.error('Google login error:', error.message);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white p-8 shadow-xl transition-all duration-300 hover:shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-indigo-900 sm:text-4xl">
            Login to your account.
          </h1>
          <p className="mt-3 text-gray-500">Hello, welcome back to your account</p>
        </div>

        {/* Webcam preview */}
        <div className="my-4">
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '8px' }} />
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-500">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="example@email.com"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-500">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Your Password"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-500">
                Remember me
              </label>
            </div>
            <div className="text-sm">
              <a href="#" className="font-medium text-gray-500 hover:text-indigo-600">
                Forgot Password?
              </a>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500">or login with</span>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={handleGoogleLogin}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm hover:bg-red-50"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
