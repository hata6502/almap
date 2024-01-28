/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["docs/index.html", "src/**/*.{html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      zIndex: {
        1000: "1000",
      },
    },
  },
  plugins: [],
};
