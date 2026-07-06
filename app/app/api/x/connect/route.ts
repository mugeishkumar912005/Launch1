import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomUUID();

  const codeVerifier = crypto.randomBytes(32).toString("hex");

  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: "http://localhost:3000/api/x/callback",
    scope: "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `https://x.com/i/oauth2/authorize?${params.toString()}`
  );

  response.cookies.set("x_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: false,
    path: "/",
  });

  response.cookies.set("x_state", state, {
    httpOnly: true,
    secure: false,
    path: "/",
  });

  return response;
}