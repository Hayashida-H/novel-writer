import { getDb } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export const COOKIE_NAME = "session_token";
export const ROLE_COOKIE_NAME = "user_role";
const SESSION_DURATION_DAYS = 7;

export type UserRole = "manager" | "reviewer";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export async function login(
  username: string,
  password: string
): Promise<{ token: string; user: AuthUser } | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const token = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  await db.insert(sessions).values({
    userId: user.id,
    token,
    expiresAt,
  });

  return {
    token,
    user: { id: user.id, username: user.username, role: user.role as UserRole },
  };
}

export async function getSessionFromToken(
  token: string
): Promise<AuthUser | null> {
  const db = getDb();
  const [session] = await db
    .select({
      userId: sessions.userId,
      username: users.username,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!session) return null;
  return {
    id: session.userId,
    username: session.username,
    role: session.role as UserRole,
  };
}

export async function getAuthFromRequest(
  request: NextRequest
): Promise<AuthUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionFromToken(token);
}

export async function requireAuth(
  request: NextRequest,
  allowedRoles?: UserRole[]
): Promise<{ user: AuthUser } | NextResponse> {
  const user = await getAuthFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { user };
}

export async function logout(token: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.token, token));
}
