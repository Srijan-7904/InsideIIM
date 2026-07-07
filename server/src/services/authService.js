import crypto from 'crypto';

const JWT_SECRET = 'insideiim-secret-key-132456';

export const testUsers = {
  user1: {
    username: 'user1',
    name: 'Sarah Jenkins',
    title: 'Junior Research Associate',
    role: 'ROLE_USER',
    password: 'password',
  },
  user2: {
    username: 'user2',
    name: 'Alexander Mercer',
    title: 'Managing Director, Equity Research',
    role: 'ROLE_ADMIN',
    password: 'password',
  },
};

export function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}
