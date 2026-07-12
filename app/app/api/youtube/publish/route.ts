import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getYoutubeAccessToken() {
  console.log("helper called");
  const session = await auth();

  console.log(session, "Session in helper");

  if (!session?.user?.id) {
    console.log("No id found in session");
    throw new Error("Unauthorized");
  }

  const account = await prisma.socialAccount.findFirst({
    where: {
      userId: session?.user?.id,
      provider: "YOUTUBE",
    },
  });

  if (!account) {
    throw new Error("YouTube account not connected");
  }

  // Access token still valid
  if (
    account.expiresAt &&
    account.expiresAt > new Date()
  ) {
    return account.accessToken;
  }

  // Refresh Access Token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: account.refreshToken!,
      grant_type: "refresh_token",
    }),
  });

  const token = await response.json();

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  await prisma.socialAccount.update({
    where: {
      id: account.id,
    },
    data: {
      accessToken: token.access_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
    },
  });

  return token.access_token;
}


export async function POST() {
  console.log("Publishing video...");
  const accessToken = await getYoutubeAccessToken();

  console.log(accessToken);

  // Upload video here

  return Response.json({
    success: true,
  });
}