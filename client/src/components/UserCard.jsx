import React from "react";
import { motion } from "framer-motion";
import GlassCardWrapper from "./GlassCardWrapper";

const UserCard = () => {
  return (
    <GlassCardWrapper className="flex items-center gap-4">
      <motion.img
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5 }}
        src="https://api.dicebear.com/7.x/identicon/svg?seed=CodeLeet"
        className="w-16 h-16 rounded-xl"
      />

      <div>
        <h2 className="text-xl font-semibold text-white">Ujjwal Rai</h2>
        <p className="text-gray-400 text-sm">Level 7 • Hacker</p>
      </div>
    </GlassCardWrapper>
  );
};

export default UserCard;
