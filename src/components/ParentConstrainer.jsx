// src/components/ParentConstrainer.jsx
import React from 'react';

const ParentConstrainer = ({ children }) => {
  return (
    <div style={{
      width: '640px',
      height: '480px',
      margin: 'auto',
      border: '1px solid #ccc',
      position: 'relative', // Key property
      overflow: 'hidden',   // Key property
      background: 'lightgreen', // Background for the parent itself to see its bounds
    }}>
      {children}
    </div>
  );
};

export default ParentConstrainer;