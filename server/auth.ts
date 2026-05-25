import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { storage } from "./storage";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";
const JWT_EXPIRES_IN = "30d";

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  role: string;
  organizationId: number | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role, organizationId: user.organizationId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  if (req.user.role !== "super_admin") { res.status(403).json({ error: "Super admin access required" }); return; }
  next();
}

export async function findOrCreateGoogleUser(profile: {
  googleId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}): Promise<{ token: string; isNew: boolean }> {
  // Try to find by Google ID first, then by email
  let user = await storage.getUserByGoogleId(profile.googleId);

  if (!user) {
    user = await storage.getUserByEmail(profile.email);
    if (user) {
      // Link Google ID to existing account
      user = await storage.updateUser(user.id, { googleId: profile.googleId, emailVerified: true });
    }
  }

  let isNew = false;
  if (!user) {
    isNew = true;
    const username = profile.email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase() + "_" + Date.now().toString().slice(-4);
    const slug = username + "_org";

    const org = await storage.createOrganization({ name: `${profile.firstName || username}'s Organization`, slug });

    user = await storage.createUser({
      email: profile.email,
      username,
      googleId: profile.googleId,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      avatarUrl: profile.avatarUrl || null,
      role: "owner",
      organizationId: org.id,
      emailVerified: true,
      isActive: true,
    });
  }

  await storage.updateUserLastLogin(user.id);

  const token = generateToken({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    organizationId: user.organizationId,
  });

  return { token, isNew };
}

export async function registerUser(email: string, username: string, password: string, firstName?: string, lastName?: string, orgName?: string) {
  const existing = await storage.getUserByEmail(email);
  if (existing) throw new Error("Email already registered");

  const hashedPassword = await hashPassword(password);
  const orgSlug = `${username.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-5)}`;
  const org = await storage.createOrganization({ name: orgName || `${username}'s Organization`, slug: orgSlug });

  const user = await storage.createUser({
    email, username, password: hashedPassword,
    firstName: firstName || null, lastName: lastName || null,
    role: "owner", organizationId: org.id, emailVerified: true, isActive: true,
  });

  const token = generateToken({ id: user.id, email: user.email, username: user.username, role: user.role, organizationId: user.organizationId });
  return { user, org, token };
}
