/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        github: {
          dark: '#0d1117',
          light: '#161b22',
          border: '#30363d',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#f8f8f2',
            a: {
              color: '#3b82f6',
              '&:hover': {
                color: '#60a5fa',
              },
            },
            h1: {
              color: '#f8f8f2',
            },
            h2: {
              color: '#f8f8f2',
            },
            h3: {
              color: '#f8f8f2',
            },
            h4: {
              color: '#f8f8f2',
            },
            code: {
              color: '#f8f8f2',
              backgroundColor: 'rgba(30, 41, 59, 0.5)',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            hr: {
              borderColor: '#30363d',
            },
            strong: {
              color: '#f8f8f2',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 