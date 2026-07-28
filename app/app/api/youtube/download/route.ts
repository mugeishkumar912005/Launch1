import { execFile } from "child_process";
import { request } from "https";
import { promisify } from "util";

export const runtime = "nodejs";

const run = promisify(execFile);

export async function POST(request:Request) {
  try {
    const { Ids } = await request.json();

    console.log("IDS",Ids)

    const channelId = Ids.channels.map((id:any) => {
      console.log("ID",id)
      return id.channelId;
    })

    console.log(channelId)
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "YOUTUBE_API_KEY is missing" }, { status: 500 });
    }

    const publishedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    channelId.map(async(Id:any) => {
    
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
        return Response.json({ success: false, error: searchData }, { status: searchResponse.status });
      }
  
      if (!searchData.items?.length) {
        return Response.json(
          { success: false, error: "No recent short videos found" },
          { status: 404 }
        );
      }
  
      const videoIds = searchData.items
        .map((item: any) => item.id?.videoId)
        .filter(Boolean);
  
      if (!videoIds.length) {
        return Response.json(
          { success: false, error: "No valid video IDs found" },
          { status: 404 }
        );
      }
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
        return Response.json({ success: false, error: statsData }, { status: statsResponse.status });
      }
  
      if (!statsData.items?.length) {
        return Response.json(
          { success: false, error: "Video statistics not found" },
          { status: 404 }
        );
      }
  
      function durationToSeconds(duration: string): number {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        const hours = Number(match[1] ?? 0);
        const minutes = Number(match[2] ?? 0);
        const seconds = Number(match[3] ?? 0);
        return hours * 3600 + minutes * 60 + seconds;
      }
  
      const rankedVideos = statsData.items
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
        .filter((video: any) => video.durationSeconds > 0 && video.durationSeconds <= 180)
        .sort((a: any, b: any) => b.trendingScore - a.trendingScore);
  
      if (!rankedVideos.length) {
        return Response.json(
          { success: false, error: "No Short candidates found" },
          { status: 404 }
        );
      }
  
      const trendingVideo = rankedVideos[0];
      console.log("Selected trending video:", trendingVideo);
      await run("yt-dlp", [trendingVideo.videoId, "-o", "downloads/%(title)s.%(ext)s"]);
  
      return Response.json({
        success: true,
        video: {
          videoId: trendingVideo.videoId,
          title: trendingVideo.title,
          description: trendingVideo.description,
          channelName: trendingVideo.channelName,
          publishedAt: trendingVideo.publishedAt,
          thumbnail: trendingVideo.thumbnail,
          duration: trendingVideo.duration,
          durationSeconds: trendingVideo.durationSeconds,
          views: trendingVideo.views,
          likes: trendingVideo.likes,
          comments: trendingVideo.comments,
          ageHours: trendingVideo.ageHours,
          viewsPerHour: trendingVideo.viewsPerHour,
          trendingScore: trendingVideo.trendingScore,
        },
      });
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