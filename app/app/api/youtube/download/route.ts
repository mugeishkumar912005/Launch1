import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, writeFile, unlink } from "fs/promises";
import cloudinary from "@/lib/cloudinary"; // ← adjust to wherever your cloudinary.ts lives

export const runtime = "nodejs";

const run = promisify(execFile);

function durationToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

async function downloadAndUpload(video: any, cookiesPath?: string) {
  const args = [
    "--extractor-args", "youtube:player_client=android",
    "-f", "best",
    "--no-playlist",
    "--no-simulate", // REQUIRED: --print implies --simulate, so without this nothing downloads
    "--print", "after_move:filepath",
    "--quiet",
    "--no-warnings",
    "-o", "downloads/%(id)s.%(ext)s",
    video.videoId,
  ];

  if (cookiesPath) {
    args.unshift("--cookies", cookiesPath);
  }

  const { stdout } = await run("yt-dlp", args);

  const filePath = stdout.trim().split("\n").pop()?.trim();
  if (!filePath) {
    throw new Error("Could not determine downloaded file path");
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "video",
      folder: "Personal",
      public_id: video.videoId,
      overwrite: true,
    });
    return result.secure_url as string;
  } finally {
    await unlink(filePath).catch(() => {});
  }
}

export async function POST(request: Request) {
  try {
    const { Ids } = await request.json();

    console.log("IDS", Ids);

    const channelId = Ids.channels.map((id: any) => {
      console.log("ID", id);
      return id.channelId;
    });

    console.log(channelId);
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "YOUTUBE_API_KEY is missing" }, { status: 500 });
    }

    // Write the cookies file once (only if provided); reused for every download this request.
    let cookiesPath: string | undefined;
    if (process.env.YTDLP_COOKIES) {
      await mkdir("cookies", { recursive: true });
      await writeFile("cookies/cookies.txt", process.env.YTDLP_COOKIES);
      cookiesPath = "cookies/cookies.txt";
    }

    const LOOKBACK_DAYS = 60   ;

    const publishedAfter = new Date(
      Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const rankedVideos: any[] = [];

    for (const Id of channelId) {
      const searchParams = new URLSearchParams({
        part: "snippet",
        channelId: Id,
        type: "video",
        order: "date",
        videoDuration: "short",
        maxResults: "20",
        publishedAfter,
        key: apiKey,
      });

      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${searchParams}`
      );
      const searchData = await searchResponse.json();

      if (!searchResponse.ok) {
        console.error("YouTube search error:", searchData);
        continue;
      }

      if (!searchData.items?.length) continue;

      const videoIds = searchData.items
        .map((item: any) => item.id?.videoId)
        .filter(Boolean);

      if (!videoIds.length) continue;

      const statsParams = new URLSearchParams({
        part: "snippet,statistics,contentDetails",
        id: videoIds.join(","),
        key: apiKey,
      });

      const statsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${statsParams}`
      );
      const statsData = await statsResponse.json();

      if (!statsResponse.ok) {
        console.error("YouTube statistics error:", statsData);
        continue;
      }

      if (!statsData.items?.length) continue;

      const ranked = statsData.items
        .map((video: any) => {
          const views = Number(video.statistics?.viewCount ?? 0);
          const likes = Number(video.statistics?.likeCount ?? 0);
          const comments = Number(video.statistics?.commentCount ?? 0);
          const durationSeconds = durationToSeconds(video.contentDetails?.duration ?? "");
          const publishedTime = new Date(video.snippet.publishedAt).getTime();
          const ageHours = Math.max((Date.now() - publishedTime) / (1000 * 60 * 60), 1);
          const viewsPerHour = views / ageHours;
          const likeRate = views > 0 ? likes / views : 0;
          const commentRate = views > 0 ? comments / views : 0;
          const trendingScore = viewsPerHour * (1 + likeRate + commentRate * 5);

          return {
            videoId: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            publishedAt: video.snippet.publishedAt,
            channelName: video.snippet.channelTitle,
            thumbnail:
              video.snippet.thumbnails?.high?.url ?? video.snippet.thumbnails?.default?.url,
            duration: video.contentDetails?.duration,
            durationSeconds,
            views,
            likes,
            comments,
            ageHours: Math.round(ageHours),
            viewsPerHour: Math.round(viewsPerHour),
            likeRate: Number((likeRate * 100).toFixed(2)),
            commentRate: Number((commentRate * 100).toFixed(3)),
            trendingScore: Math.round(trendingScore),
          };
        })
        .filter((video: any) => video.durationSeconds > 0 && video.durationSeconds <= 240);

      const topPerChannel = ranked
        .sort((a: any, b: any) => b.trendingScore - a.trendingScore)
        .slice(0, 3);

      rankedVideos.push(...topPerChannel);
    }

    rankedVideos.sort((a, b) => b.trendingScore - a.trendingScore);

    console.log("Selected videos:", rankedVideos);

    const uploadedVideos = [];

    for (const video of rankedVideos) {
      try {
        console.log(`Downloading ${video.title} (${video.trendingScore})`);
        const cloudinaryUrl = await downloadAndUpload(video, cookiesPath);
        uploadedVideos.push({ ...video, cloudinaryUrl });
      } catch (err) {
        console.error(
          `Failed for ${video.videoId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return Response.json({
      success: true,
      total: uploadedVideos.length,
      videos: uploadedVideos,
    });
  } catch (error) {
    console.error("Trending video selection failed:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}