import cron from "node-cron";

console.log("Cron scheduler started");

cron.schedule("0 * * * *", async () => {
  console.log("Running publish job");

  try {
    const response = await fetch(
      "https://launch1-production-36e4.up.railway.app/api/youtube/publish"
    );

    const body = await response.text();

    console.log("Status:", response.status);
    console.log("Response:", body);

  } catch (e) {
    console.error("Cron failed:", e);
  }
});