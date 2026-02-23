import { NextRequest, NextResponse } from "next/server";
import { logout, COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    await logout(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  response.cookies.delete(ROLE_COOKIE_NAME);
  return response;
}
