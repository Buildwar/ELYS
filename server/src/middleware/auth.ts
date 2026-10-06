import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'elys_super_secret_jwt_key_2026';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'user';
  mustChangePassword?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      mustChangePassword: Boolean(user.mustChangePassword),
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;

    // Check user active status in database
    const userRecord = db.prepare('SELECT id, username, email, role, is_active FROM users WHERE id = ?').get(payload.id) as {
      id: string;
      username: string;
      email: string;
      role: 'admin' | 'operator' | 'user';
      is_active: number;
    } | undefined;

    if (!userRecord || userRecord.is_active === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o desactivado' });
    }

    req.user = {
      ...payload,
      role: userRecord.role,
    };

    // Force password change enforcement: block other routes until password is changed
    if (
      payload.mustChangePassword &&
      !req.originalUrl.includes('/auth/change-password') &&
      !req.originalUrl.includes('/auth/me')
    ) {
      return res.status(403).json({
        error: 'Debe cambiar su contraseña inicial antes de continuar.',
        code: 'MUST_CHANGE_PASSWORD',
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireRole(allowedRoles: ('admin' | 'operator' | 'user')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado: Permisos insuficientes' });
    }

    next();
  };
}
