import React from "react";
import GlassCardWrapper from "./GlassCardWrapper";

const RecentSubmissionCard = () => {
  return (
    <GlassCardWrapper>
      <h3 className="text-white text-lg mb-3">Recent Submissions</h3>

      <div className="space-y-3">
        {["Two Sum", "Binary Tree Paths", "Longest Substring"].map(
          (name, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-white/10 pb-2"
            >
              <p className="text-gray-300">{name}</p>
              <span className="text-green-400 text-sm">Accepted</span>
            </div>
          )
        )}
      </div>
    </GlassCardWrapper>
  );
};

export default RecentSubmissionCard;
