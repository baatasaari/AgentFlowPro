import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, organizations } from "@shared/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

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

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export async function registerUser(email: string, username: string, password: string, firstName?: string, lastName?: string, orgName?: string) {
  const existingUser = await db.select().from(users).where(eq(users.email, email));
  if (existingUser.length > 0) {
    throw new Error("Email already registered");
  }

  const existingUsername = await db.select().from(users).where(eq(users.username, username));
  if (existingUsername.length > 0) {
    throw new Error("Username already taken");
  }

  const hashedPassword = await hashPassword(password);

  // Create organization for the user
  const orgSlug = (orgName || username).toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const uniqueSlug = `${orgSlug}-${Date.now()}`;

  const [org] = await db.insert(organizations).values({
    name: orgName || `${username}'s Organization`,
    slug: uniqueSlug,
    plan: "free",
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
  }).returning();

  const [user] = await db.insert(users).values({
    email,
    username,
    password: hashedPassword,
    firstName: firstName || null,
    lastName: lastName || null,
    role: "owner",
    organizationId: org.id,
    emailVerified: true, // Skip email verification in dev
  }).returning();

  return { user, org };
}
