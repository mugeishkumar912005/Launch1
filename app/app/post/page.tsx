"use client";

import { useState } from "react";
import AddedMedias from "../postComponents/addedMedias";
import Preview from "../postComponents/preview";

export default function PostPage() {
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  return (
    <>
    <div className="flex pl-10 flex-col items-start">
        <AddedMedias
          selectedPlatforms={selectedPlatforms}
          setSelectedPlatforms={setSelectedPlatforms}
        />
      </div>
    <main className="flex h-screen items-start gap-8 overflow-hidden p-8">
      {/* Sidebar - only as tall/wide as its content */}

      {/* Form card */}
      <div className="flex h-fit max-w-3xl w-full  flex-col gap-6  rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Create Post</h1>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Caption</label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Upload Media</label>
            <div className="flex h-44 items-center justify-center rounded-lg border-2 border-dashed">
              Upload Image / Video
            </div>
          </div>

          <input type="datetime-local" className="w-full rounded-lg border p-3" />

          <button className="w-full rounded-lg bg-black py-3 text-white">
            Schedule
          </button>
        </div>
      </div>

      {/* Preview - fills remaining width, scrolls on its own, capped height */}
      <div className="flex h-full w-xl  flex-1 flex-col overflow-y-auto rounded-xl bg-white shadow">
        <Preview
          caption={content}
          selectedPlatforms={selectedPlatforms}
        />
      </div>
    <button
  onClick={async () => {
    const res = await fetch("/api/youtube/publish", {
  method: "POST",
});

const text = await res.text();

console.log("Status:", res.status);
console.log("Response:", text);
  }}
>
  Test Publish
</button>
    </main>

    </>
  );
}