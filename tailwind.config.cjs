/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './index.html',
      './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
      extend: {
        keyframes: {
          shake: {
            '0%, 100%': { transform: 'translateX(0)' },
            '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-1px)' },
            '20%, 40%, 60%, 80%': { transform: 'translateX(1px)' },
          },
          fadeIn: {
            '0%': { opacity: '0', transform: 'translateY(-10px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          },
          stackIn: {
            '0%': { opacity: '0', transform: 'translateX(-20px)' },
            '100%': { opacity: '1', transform: 'translateX(0)' },
          },
          conveyorIn: {
            '0%': { opacity: '0', transform: 'translateY(-100%)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          },
          conveyorOut: {
            '0%': { opacity: '1', transform: 'translateY(0)' },
            '100%': { opacity: '0', transform: 'translateY(100%)' },
          },
          curtainReveal: {
            '0%': { 
              transform: 'translateY(-100%)',
              background: 'linear-gradient(180deg, white, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.95))'
            },
            '100%': { 
              transform: 'translateY(0%)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9) 50%, white)'
            }
          },
          shimmerOverlay: {
            '0%': { 
              opacity: '0.5',
              backgroundPosition: '200% 50%'
            },
            '100%': { 
              opacity: '0.8',
              backgroundPosition: '-200% 50%'
            }
          }
        },
        animation: {
          shake: 'shake 0.5s ease-in-out infinite',
          fadeIn: 'fadeIn 1s ease-out forwards',
          stackIn: 'stackIn 0.5s ease-out forwards',
          conveyorIn: 'conveyorIn 0.7s ease-out forwards',
          conveyorOut: 'conveyorOut 0.7s ease-in forwards',
          curtain: 'curtainReveal 1.5s ease-in-out forwards',
          shimmer: 'shimmerOverlay 2s linear infinite'
        }
      },
    },
    plugins: [],
  };