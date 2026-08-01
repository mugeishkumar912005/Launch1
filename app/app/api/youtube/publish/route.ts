import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import { toast } from "sonner";

export const runtime = "nodejs";

/**
 * Get the YouTube access token for the account that
 * automated publishing should use.
 */
async function getYoutubeAccessToken() {
  const email = process.env.YOUTUBE_PUBLISH_USER_EMAIL;

  if (!email) {
    throw new Error(
      "YOUTUBE_PUBLISH_USER_EMAIL environment variable is missing"
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new Error("Publishing user not found");
  }

  const account = await prisma.socialAccount.findFirst({
    where: {
      userId: user.id,
      provider: "YOUTUBE",
    },
  });

  if (!account) {
    throw new Error("YouTube account not connected");
  }

  // Access token is still valid
  if (
    account.accessToken &&
    account.expiresAt &&
    account.expiresAt > new Date()
  ) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    throw new Error("YouTube refresh token missing");
  }

  console.log("Access token expired. Refreshing...");

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: new URLSearchParams({
        client_id:
          process.env.AUTH_GOOGLE_ID!,

        client_secret:
          process.env.AUTH_GOOGLE_SECRET!,

        refresh_token:
          account.refreshToken,

        grant_type:
          "refresh_token",
      }),
    }
  );

  const token = await response.json();

  if (!response.ok) {
    console.error(
      "Token refresh error:",
      token
    );

    throw new Error(
      "Failed to refresh YouTube access token"
    );
  }

  await prisma.socialAccount.update({
    where: {
      id: account.id,
    },

    data: {
      accessToken:
        token.access_token,

      expiresAt: new Date(
        Date.now() +
          token.expires_in * 1000
      ),
    },
  });

  return token.access_token;
}


/**
 * Publish ONE Cloudinary video to YouTube.
 */
async function publishVideo(
  video: any,
  accessToken: string
) {
  console.log(
    "Fetching from Cloudinary:",
    video.secure_url
  );

  // ----------------------------------------
  // GET VIDEO FROM CLOUDINARY
  // ----------------------------------------

  const cloudResponse = await fetch(
    video.secure_url
  );

  if (!cloudResponse.ok) {
    throw new Error(
      `Failed to fetch ${video.public_id} from Cloudinary`
    );
  }

  const videoBuffer =
    await cloudResponse.arrayBuffer();

  const videoType =
    cloudResponse.headers.get(
      "content-type"
    ) || "video/mp4";

  console.log(
    "Video size:",
    videoBuffer.byteLength
  );

  // ----------------------------------------
  // INITIALIZE YOUTUBE RESUMABLE UPLOAD
  // ----------------------------------------

  const initResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",

        "X-Upload-Content-Type":
          videoType,

        "X-Upload-Content-Length":
          videoBuffer.byteLength.toString(),
      },

      body: JSON.stringify({
        snippet: {
          title:
            video.display_name ||
            video.public_id
              .split("/")
              .pop() ||
            "Untitled Video",

          description: "",
        },

        status: {
          privacyStatus: "public",
        },
      }),
    }
  );

  if (!initResponse.ok) {
    const error =
      await initResponse.text();

    console.error(
      "YouTube init error:",
      error
    );

    throw new Error(
      `Failed to initialize YouTube upload: ${error}`
    );
  }

  const uploadUrl =
    initResponse.headers.get(
      "location"
    );

  if (!uploadUrl) {
    throw new Error(
      "YouTube did not return upload URL"
    );
  }

  console.log(
    "YouTube upload session created"
  );

  // ----------------------------------------
  // UPLOAD VIDEO
  // ----------------------------------------

  const uploadResponse =
    await fetch(uploadUrl, {
      method: "PUT",

      headers: {
        "Content-Type":
          videoType,

        "Content-Length":
          videoBuffer.byteLength.toString(),
      },

      body: videoBuffer,
    });

  const youtubeResult =
    await uploadResponse.json();

  if (!uploadResponse.ok) {
    console.error(
      "YouTube upload error:",
      youtubeResult
    );

    throw new Error(
      "YouTube video upload failed"
    );
  }

  console.log(
    "YouTube upload successful:",
    youtubeResult.id
  );

  // ----------------------------------------
  // DELETE FROM CLOUDINARY
  // ONLY AFTER YOUTUBE SUCCESS
  // ----------------------------------------

  const deleteResult =
    await cloudinary.uploader.destroy(
      video.public_id,
      {
        resource_type: "video",
        invalidate: true,
      }
    );

  console.log(
    "Cloudinary deletion:",
    video.public_id,
    deleteResult
  );
  toast.success("Successfully deleted video from Cloudinary");
  return {
    success: true,
    youtubeVideoId:
      youtubeResult.id,
    cloudinaryPublicId:
      video.public_id,
    cloudinaryDeleteResult:
      deleteResult.result,
  };
}


/**
 * Called automatically by Vercel Cron.
 */
export async function GET() {
  try {
    console.log(
      "Starting scheduled YouTube publishing..."
    );

    // ----------------------------------------
    // GET ACCESS TOKEN
    // ----------------------------------------

    const accessToken =
      await getYoutubeAccessToken();

    // ----------------------------------------
    // GET CLOUDINARY VIDEOS
    // ----------------------------------------

    const cloudVideos =
      await cloudinary.api.resources({
        resource_type: "video",
        type: "upload",
      

        prefix:
          "Personal/",

        max_results: 100,
      });

    const videos =
      cloudVideos.resources || [];

    console.log(
      "Cloudinary videos found:",
      videos.length
    );
    toast.success("Successfully fetched Cloudinary video");
    if (!videos.length) {
      return Response.json({
        success: true,
        message:
          "No videos waiting to be published",
        published: 0,
      });
    }

    // ----------------------------------------
    // PUBLISH VIDEOS
    // ----------------------------------------

    const video = videos[0];

console.log("Publishing:", video.public_id);

try {
  const result = await publishVideo(
    video,
    accessToken
  );

  toast.success("Successfully published video");
  return Response.json({
    success: true,
    published: video.public_id,
    result,
    remainingVideos: videos.length - 1,
  });

} catch (error) {

  console.error(
    `Failed ${video.public_id}:`,
    error
  );

  toast.error("Failed to publish video");

  return Response.json(
    {
      success: false,
      cloudinaryPublicId: video.public_id,
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

  } catch (error) {
    toast.error("Scheduled publishing failed");   
    console.error(
      "Scheduled publishing failed:",
      error
    );

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