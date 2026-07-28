import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getYoutubeAccessToken() {
  console.log("helper called");
  const session = await auth();

if (!session?.user?.email) {
  throw new Error("Unauthorized");
}

const user = await prisma.user.findUnique({
  where: {
    email: session.user.email,
  },
});

if (!user) {
  throw new Error("User not found");
}
console.log("UUser found now finding account...");
const account = await prisma.socialAccount.findFirst({
  where: {
    userId: user.id,
    provider: "YOUTUBE",
  },
});
console.log("Account found:", account);
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
  console.log("Access token expired, refreshing...");
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

  console.log("New access token:", token);

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


export async function POST(request: Request) {
  try {
    console.log("Publishing video...");

    // Get valid YouTube access token
    const accessToken = await getYoutubeAccessToken();
    
    console.log("Access token:", accessToken);

    // Get FormData
    const formData = await request.formData();

    console.log("Form data received");

    const video = formData.get("video") as File | null;
    const content = formData.get("content") as string | null;

    if (!video) {
      return Response.json(
        {
          success: false,
          error: "Video is required",
        },
        {
          status: 400,
        }
      );
    }

    console.log("Video:", video.name);
    console.log("Video type:", video.type);
    console.log("Video size:", video.size);
    console.log("Content:", content);

    // Create YouTube resumable upload session
    const initResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": video.type,
          "X-Upload-Content-Length": video.size.toString(),
        },

        body: JSON.stringify({
          snippet: {
            title: content || "Untitled Video",
            description: content || "",
          },

          status: {
            // Keep private while testing
            privacyStatus: "private",
          },
        }),
      }
    );

    // Check initialization error
    if (!initResponse.ok) {
      const error = await initResponse.text();

      console.error("YouTube init error:", error);

      return Response.json(
        {
          success: false,
          error: "Failed to initialize YouTube upload",
          details: error,
        },
        {
          status: initResponse.status,
        }
      );
    }

    // YouTube gives us the upload URL
    const uploadUrl = initResponse.headers.get("location");

    if (!uploadUrl) {
      throw new Error("YouTube did not return an upload URL");
    }

    console.log("Upload session created");

    // Get actual video bytes
    const videoBuffer = await video.arrayBuffer();

    console.log("Uploading video to YouTube...");

    // Upload video
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",

      headers: {
        "Content-Type": video.type || "video/mp4",
        "Content-Length": videoBuffer.byteLength.toString(),
      },

      body: videoBuffer,
    });

    const result = await uploadResponse.json();

    // Check upload error
    if (!uploadResponse.ok) {
      console.error("YouTube upload error:", result);

      return Response.json(
        {
          success: false,
          error: "YouTube upload failed",
          details: result,
        },
        {
          status: uploadResponse.status,
        }
      );
    }

    console.log("YouTube upload successful");
    console.log("Video ID:", result.id);

    return Response.json({
      success: true,
      message: "Video uploaded successfully",
      videoId: result.id,
    });
  } catch (error) {
    console.error("Publish error:", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}