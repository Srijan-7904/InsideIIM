import { verifyToken } from '../services/authService.js';

export function requireAuth(request, response, next) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return response.status(401).json({
      message: 'Access Denied: No Token Provided',
    });
  }

  const token = authHeader.split(' ')[1];
  const user = verifyToken(token);
  if (!user) {
    return response.status(401).json({
      message: 'Access Denied: Invalid or Expired Token',
    });
  }

  request.user = user;
  return next();
}

export function requireRole(allowedRole) {
  return (request, response, next) => {
    if (!request.user) {
      return response.status(401).json({
        message: 'Access Denied: User Not Authenticated',
      });
    }

    if (request.user.role !== allowedRole) {
      return response.status(403).json({
        message: `Access Denied: Required Role is ${allowedRole}`,
      });
    }

    return next();
  };
}
