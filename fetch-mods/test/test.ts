import { fetchMods } from "../fetch-mods";
import modsJson from "./mods.json";
// import { discordHookUrl, ghToken, discordModHookUrls } from "./secrets.json";
import { googleServiceAccount } from "./secrets.json";
import nextDatabase from "./next-database.json";
import previousDatabase from "./previous-database.json";
import { getDiff } from "../get-diff";
import { sendDiscordNotifications } from "../send-discord-notifications";
import { toJsonString } from "../to-json-string";
import {
  analyticsreporting_v4,
  auth,
  analyticsreporting,
} from "@googleapis/analyticsreporting";
import { BetaAnalyticsDataClient, v1beta } from "@google-analytics/data";

const ga4PropertyId = 251990931;
const routeBase = "outerwildsmods.com/mods/";
const routeRegex = new RegExp(`${routeBase}[^\/]+\/$`);

async function test() {
  const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: JSON.parse(googleServiceAccount),
    projectId: "outer-wilds-mods",
  });

  const [result] = await analyticsDataClient.runReport({
    property: `properties/${ga4PropertyId}`,
    dimensions: [
      {
        name: "fullPageUrl",
      },
    ],
    dateRanges: [
      {
        startDate: "30daysAgo",
        endDate: "yesterday",
      },
    ],
    metrics: [
      {
        name: "screenPageViews",
      },
    ],
    metricAggregations: [1],
  });

  if (!result.rows) {
    console.log("empty rows returned");
    return;
  }

  const output = result.rows.reduce<Record<string, number>>((record, row) => {
    if (!row.dimensionValues || !row.metricValues) return record;

    const route = row.dimensionValues[0]?.value;

    if (!route || route.length <= routeBase.length || !routeRegex.test(route)) {
      return record;
    }

    const key = route.slice(routeBase.length, -1);

    const value = Number.parseInt(row.metricValues[0]?.value ?? "");

    if (isNaN(value)) return record;

    return {
      ...record,
      [key]: value,
    };
  }, {});

  console.log("result", JSON.stringify(output, null, 2));
}

test();
