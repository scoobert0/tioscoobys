/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/panel/views/**/*.ejs', // Scan all EJS files in the views directory
  ],
  darkMode: 'class', // Use 'class' strategy for dark mode
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
