import React from "react";
import GlassCardWrapper from "./GlassCardWrapper";

const StatsCard = () => {
  return (
    <GlassCardWrapper className="grid grid-cols-3 gap-5 text-center">
      <div>
        <p className="text-3xl text-purple-400 font-bold">127</p>
        <p className="text-gray-400 text-sm">Problems Solved</p>
      </div>
      <div>
        <p className="text-3xl text-green-400 font-bold">#3421</p>
        <p className="text-gray-400 text-sm">Ranking</p>
      </div>
      <div>
        <p className="text-3xl text-yellow-400 font-bold">9🔥</p>
        <p className="text-gray-400 text-sm">Day Streak</p>
      </div>
    </GlassCardWrapper>
  );
};

export default StatsCard;
