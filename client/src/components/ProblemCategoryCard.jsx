import React from "react";
import { Code2 } from "lucide-react";
import GlassCardWrapper from "./GlassCardWrapper";

const ProblemCategoryCard = ({ title, problems }) => {
  return (
    <GlassCardWrapper className="cursor-pointer hover:bg-white/10 transition">
      <div className="flex items-center gap-3">
        <Code2 className="text-purple-400" />
        <h3 className="text-lg text-white font-medium">{title}</h3>
      </div>
      <p className="text-gray-400 text-sm mt-2">{problems} Problems</p>
    </GlassCardWrapper>
  );
};

export default ProblemCategoryCard;
