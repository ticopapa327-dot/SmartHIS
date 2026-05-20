import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 7070);
const host = process.env.HOST ?? "127.0.0.1";
const server = createApp({
  enableNaturalOperation: process.env.SMARTHIS_NATURAL_OPERATION !== "0",
  naturalOperation: {
    patientCount: process.env.SMARTHIS_NATURAL_PATIENT_COUNT,
    roomCount: process.env.SMARTHIS_NATURAL_ROOM_COUNT,
    dailyNewPatients: process.env.SMARTHIS_NATURAL_DAILY_ADMISSIONS,
    tickIntervalMs: process.env.SMARTHIS_NATURAL_TICK_MS
  }
});

server.listen(port, host, () => {
  console.log(`SmartHIS is running at http://${host}:${port}`);
});
