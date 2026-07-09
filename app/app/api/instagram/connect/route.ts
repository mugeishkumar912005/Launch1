import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_CLIENT_ID!,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    response_type: "code",
    scope:
      "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments",
    state,
  });

  const response = NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  );

  response.cookies.set("instagram_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}