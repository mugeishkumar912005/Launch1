import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    // 1. Get logged-in user
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get authorization code
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code missing" },
        { status: 400 }
      );
    }

    // 3. Exchange code for tokens
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.AUTH_GOOGLE_ID!,
          client_secret: process.env.AUTH_GOOGLE_SECRET!,
          code,
          redirect_uri: "https://launch-cli.vercel.app/api/youtube/callback",
          grant_type: "authorization_code",
        }),
      }
    );

    const tokens = await tokenResponse.json();

    // 4. Get YouTube channel details
    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const channel = await channelResponse.json();

    const channelId = channel.items[0].id;

    // 5. Find current user
    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 6. Save YouTube account
    await prisma.socialAccount.create({
      data: {
        provider: "YOUTUBE",
        providerUserId: channelId,

        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,

        expiresAt: new Date(
          Date.now() + tokens.expires_in * 1000
        ),

        userId: user.id,
      },
    });

    // 7. Go back home
    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}