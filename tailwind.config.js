/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Watch all React files in src folder
  ],
  theme: {
    extend: {},
  },
  plugins: [
     require("tailwindcss-animate")
  ],
}