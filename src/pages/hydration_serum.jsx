// src/pages/hydration_serum.jsx
import React from 'react';
import FaceEffect from '../components/FaceEffect';

const HydrationSerumPage = () => {
  return (
    <div className="p-4 max-w-6xl mx-auto">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-blue-600">Hydration Serum Try-On</h1>
        <p className="mt-2 text-gray-600">Experience our hydration serum effect on your skin</p>
      </header>

      <div className="mb-6">
        <FaceEffect effectType="hydration" />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-3">About Hydration Serum</h2>
        <p className="text-gray-700">
          Our advanced hydration serum provides deep moisture and rejuvenation to your skin. 
          The AR try-on above shows the potential glow and hydration effect you can expect with regular use.
        </p>
      </div>
    </div>
  );
};

export default HydrationSerumPage;
