import React from "react";
import { motion } from "framer-motion";
import GlassCardWrapper from "./GlassCardWrapper";

const ProgressGraph = () => {
  const data = [5, 9, 6, 12, 4, 8, 10];

  return (
    <GlassCardWrapper>
      <h3 className="text-white text-lg mb-4">Your Weekly Progress</h3>

      <div className="flex items-end gap-3 h-32">
        {data.map((value, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: value * 8 }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="w-6 rounded-xl bg-purple-500/70"
          />
        ))}
      </div>
    </GlassCardWrapper>
  );
};

export default ProgressGraph;
