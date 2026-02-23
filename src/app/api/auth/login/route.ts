import { NextRequest, NextResponse } from "next/server";
import { login, COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 }
    );
  }

  const result = await login(username, password);
  if (!result) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const maxAge = 7 * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production";

  const response = NextResponse.json({
    user: { username: result.user.username, role: result.user.role },
  });

  response.cookies.set(COOKIE_NAME, result.token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  response.cookies.set(ROLE_COOKIE_NAME, result.user.role, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return response;
}
