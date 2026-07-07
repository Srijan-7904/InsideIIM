export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 0 1px rgba(0,0,0,0.04), 0 20px 50px rgba(15, 23, 42, 0.06)',
      },
      colors: {
        ink: '#0f172a',
        panel: '#ffffff',
        panelSoft: '#f8fafc',
        accent: '#6366f1',
        accentStrong: '#4f46e5',
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
      },
      fontFamily: {
        display: ['"Avenir Next"', '"Segoe UI"', 'sans-serif'],
        body: ['"Inter"', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
