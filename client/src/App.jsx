import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('auth_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  function handleLoginSuccess(userData) {
    setUser(userData);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <DashboardPage user={user} onLogout={handleLogout} />
          ) : (
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
