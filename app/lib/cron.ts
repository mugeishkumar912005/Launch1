import cron from "node-cron";

console.log("Cron scheduler started");

cron.schedule("0 * * * *", async () => {
  console.log("Running publish job at", new Date().toISOString());

  try {
    const response = await fetch(
      "https://launch1-production-36e4.up.railway.app/api/youtube/publish"
    );

    console.log("Status:", response.status);

    const body = await response.text();

    console.log(body);

  } catch (e) {
    console.error("Cron failed:", e);
  }
});