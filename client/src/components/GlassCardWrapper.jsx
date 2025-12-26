import React from "react";

const GlassCardWrapper = ({ children, className }) => {
  return (
    <div
      className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] p-5 ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassCardWrapper;
