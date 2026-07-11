import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Authorization code not found" },
      { status: 400 }
    );
  }

  const tokenResponse = await fetch(
    "https://api.instagram.com/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
        code,
      }),
    }
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return NextResponse.json(tokenData, {
      status: tokenResponse.status,
    });
  }

  const userResponse = await fetch(
    `https://graph.instagram.com/me?fields=user_id,username&access_token=${tokenData.access_token}`
  );

  const userData = await userResponse.json();

  await prisma.socialAccount.create({
    data: {
      provider: "INSTAGRAM",
      providerUserId: String(userData.user_id),
      accessToken: tokenData.access_token,
      user: {
        connect: {
          email: session.user.email,
        },
      },
    },
  });

  return NextResponse.redirect(new URL("/", req.url));
}