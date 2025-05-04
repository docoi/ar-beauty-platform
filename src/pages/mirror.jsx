// src/pages/mirror.jsx
import React from 'react';
import LipstickMirror from '@/components/LipstickMirror';

const MirrorPage = () => {
  return (
    <div className="w-full h-screen overflow-hidden bg-black">
      <LipstickMirror />
    </div>
  );
};

export default MirrorPage;
