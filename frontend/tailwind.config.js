/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        fogon: {
          brown: '#633806',
          amber: '#EF9F27',
          cream: '#FAEEDA',
          green: '#3B6D11',
          white: '#FFF8F0',
          gray: '#A89070',
        }
      }
    },
  },
  plugins: [],
}
