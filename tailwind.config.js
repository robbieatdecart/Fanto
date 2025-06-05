/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        morphing: {
          '0%': { 
            opacity: '0.9',
            filter: 'blur(0px)',
            transform: 'translateY(-7%) scale(1)'
          },
          '50%': { 
            opacity: '0.5',
            filter: 'blur(2px)',
            transform: 'translateY(-7%) scale(0.98)'
          },
          '100%': { 
            opacity: '0.9',
            filter: 'blur(0px)',
            transform: 'translateY(-7%) scale(1)'
          }
        },
        stackIn: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        conveyorIn: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        }
      },
      animation: {
        morphing: 'morphing 1.5s ease-in-out infinite',
        stackIn: 'stackIn 0.5s ease-out forwards',
        conveyorIn: 'conveyorIn 0.3s ease-out forwards'
      }
    },
  },
  plugins: [],
} 