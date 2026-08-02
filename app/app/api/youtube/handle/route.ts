import { toast } from "sonner";

export async function POST(request: Request) {
  try {
    const { handles } = await request.json();

    if (!handles || !Array.isArray(handles)) {
      return Response.json(
        {
          success: false,
          error: "Invalid request",
        },
        { status: 400 }
      );
    }

    // Get channel details for every handle
    const channels = await Promise.all(
      handles.map(async (handle: string) => {
        const params = new URLSearchParams({
          part: "id,snippet",
          forHandle: handle,
          key: process.env.YOUTUBE_API_KEY!,
        });

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?${params}`
        );

        const data = await response.json();

        // API error
        if (!response.ok) {
          return {
            success: false,
            handle,
            error: data,
          };
        }

        // Channel doesn't exist
        if (!data.items?.length) {
          return {
            success: false,
            handle,
            error: "Channel not found",
          };
        }

        const channel = data.items[0];

        console.log(
          `${handle} -> ${channel.id}`
        );

        return {
          success: true,
          handle,
          channelId: channel.id,
          channelName: channel.snippet.title,
          thumbnail:
            channel.snippet.thumbnails?.default?.url,
        };
      })
    );
     
    // ONE response after all handles are processed
    return Response.json({
      success: true,
      channels,
    });
    
  } catch (error) {
    console.error("Channel lookup error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to get channels",
      },
      { status: 500 }
    );
  }
}