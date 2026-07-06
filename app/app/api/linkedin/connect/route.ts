import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.CLIENT_ID!,
    redirect_uri: "http://localhost:3000/api/linkedin/callback",
    scope: "openid profile email w_member_social",
    state: crypto.randomUUID(),
  });

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );
}