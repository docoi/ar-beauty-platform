import React from "react";

const ComingSoon = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-400 flex items-center justify-center text-white px-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-md">
          👁️‍🗨️ Welcome to <span className="text-yellow-300">vTryit</span>
        </h1>

        <p className="text-lg md:text-xl mb-6 leading-relaxed">
          Experience the future of shopping with immersive virtual try-on.
          <br />
          vTryit is where creators, influencers, and beauty brands showcase their
          products with stunning AR effects and sleek interactive displays.
        </p>

        <p className="text-md md:text-lg mb-6 opacity-90">
          Whether it's cosmetics, fashion, or accessories — vTryit helps customers "try before they buy"
          with confidence, leading to higher sales and fewer returns.
        </p>

        <div className="bg-white text-gray-800 rounded-lg px-6 py-4 shadow-md inline-block">
          <span className="text-xl font-semibold">🚧 Coming Soon</span>
          <p className="text-sm mt-1">We're working hard behind the scenes. Stay tuned!</p>
        </div>

        {/* Optional: Social Icons or Email Capture */}
        {/* <div className="mt-6">
          <input
            type="email"
            placeholder="Enter your email to stay updated"
            className="px-4 py-2 rounded-l-md text-gray-800"
          />
          <button className="bg-yellow-400 text-gray-900 px-4 py-2 rounded-r-md font-bold">
            Notify Me
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default ComingSoon;
