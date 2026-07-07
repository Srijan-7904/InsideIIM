import { Router } from 'express';
import { generateToken, testUsers } from '../services/authService.js';

export const authRouter = Router();

authRouter.post('/login', (request, response) => {
  const { username, password } = request.body ?? {};

  if (!username || !password) {
    return response.status(400).json({
      message: 'Username and password are required',
    });
  }

  const user = testUsers[username];
  if (!user || user.password !== password) {
    return response.status(401).json({
      message: 'Invalid username or password',
    });
  }

  const payload = {
    username: user.username,
    name: user.name,
    title: user.title,
    role: user.role,
  };

  const token = generateToken(payload);

  return response.json({
    token,
    user: payload,
  });
});
