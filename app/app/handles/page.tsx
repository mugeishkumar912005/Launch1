"use client";

import { useState } from "react";

export default function HandlesPage() {
  const [handles, setHandles] = useState("");

  async function sendHandles() {
    try {
      // Convert:
      // @MrBeast, @channel2, @channel3
      // into an array
      const handleArray = handles
        .split(",")
        .map((handle) => handle.trim())
        .filter(Boolean);

      console.log("Sending:", handleArray);

      const response = await fetch("/api/youtube/handle", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          handles: handleArray,
        }),
      });

      const data = await response.json();

      if(response.status === 200) {
        const downloadCall = await fetch('/api/youtube/download',{
            method: "POST",
            headers:{
                "Content-Type":"application/json",
            },
            body:JSON.stringify({
                Ids:data
            })
        })
      }

      if (!response.ok) {
        console.error("API Error:", data);
        return;
      }

      console.log("Response:", data);
    } catch (error) {
      console.error("Request failed:", error);
    }
  }

  return (
    <div className="mt-60 flex h-full flex-col items-center justify-center gap-10">

      <input
        type="text"
        placeholder="Enter handles, separated by commas"
        value={handles}
        onChange={(e) => setHandles(e.target.value)}
        className="w-full max-w-2xl border p-2 focus:ring-0"
      />

      <button
        onClick={sendHandles}
        className="rounded-sm cursor-pointer bg-black p-2 text-white"
      >
        Submit
      </button>

    </div>
  );
}