// src/components/TestInConstrainedParent.jsx
import React from 'react';
import ParentConstrainer from './ParentConstrainer';
import TestWebGPUCanvas from './TestWebGPUCanvas'; // The one that worked full-magenta before

const TestInConstrainedParent = () => {
  return (
    <ParentConstrainer>
      <TestWebGPUCanvas />
    </ParentConstrainer>
  );
};

export default TestInConstrainedParent;