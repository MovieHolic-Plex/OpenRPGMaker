import { calendarDayKey, type GameTime } from "@/project/gameTime";
import type { PlaySession } from "@/project/session";

/**
 * Marks eligible plots as watered for the already-resolved destination date.
 * Day-transition orchestration must call this after applying weather and before farm growth sync.
 */
export function waterFarmPlotsForDailyWeather(
  session: Pick<PlaySession, "dailyWeather" | "farmPlots" | "gameTime">,
  destinationDate: GameTime | undefined = session.gameTime,
): number {
  const weather = session.dailyWeather;
  if (!destinationDate || !weather) return 0;
  if (weather.dayKey !== calendarDayKey(destinationDate)) return 0;
  if ((weather.kind !== "rain" && weather.kind !== "storm")
    || !Number.isFinite(weather.intensity)
    || weather.intensity <= 0) return 0;

  let watered = 0;
  for (const plots of Object.values(session.farmPlots ?? {})) {
    for (const [key, plot] of Object.entries(plots)) {
      if (!plot.tilled || plot.watered || plot.dead === true) continue;
      plots[key] = { ...plot, watered: true };
      watered += 1;
    }
  }
  return watered;
}
