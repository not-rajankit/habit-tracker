const isProduction = process.env.NODE_ENV === 'production';

export const authConfig = {
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || 'dev-access-secret-change-me',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  frontendUrl: (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''),
  apiUrl: (process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, ''),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
};

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const GOOGLE_STATE_COOKIE = 'google_oauth_state';
