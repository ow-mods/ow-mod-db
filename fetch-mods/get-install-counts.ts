import { BetaAnalyticsDataClient } from "@google-analytics/data";

const ga4PropertyId = 251990931;

export async function getInstallCounts(
  daysAgo: number,
  base64GoogleServiceAccountCredentials: string
) {
  try {
    const googleServiceAccountCredentials = Buffer.from(
      base64GoogleServiceAccountCredentials,
      "base64"
    ).toString();

    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: JSON.parse(googleServiceAccountCredentials),
      projectId: "outer-wilds-mods",
    });

    const [result] = await analyticsDataClient.runReport({
      property: `properties/${ga4PropertyId}`,
      dimensions: [
        {
          name: "customEvent:mod_unique_name",
        },
        {
          name: "eventName",
        },
      ],
      metrics: [
        {
          name: "eventCount",
        },
      ],
      dateRanges: [
        {
          startDate: `${daysAgo}daysAgo`,
          endDate: "today",
        },
      ],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: {
            matchType: "EXACT",
            value: "mod_install",
          },
        },
      },
      orderBys: [
        {
          metric: {
            metricName: "eventCount",
          },
          desc: true,
        },
      ],
    });

    if (!result.rows) {
      console.log("empty rows returned");
      return;
    }

    const output = result.rows.reduce<Record<string, number>>((record, row) => {
      if (!row.dimensionValues || !row.metricValues) return record;

      const modUniqueName = row.dimensionValues[0]?.value;

      if (!modUniqueName) {
        return record;
      }

      const value = Number.parseInt(row.metricValues[0]?.value ?? "");

      if (isNaN(value)) return record;

      return {
        ...record,
        [modUniqueName]: (record[modUniqueName] ?? 0) + value,
      };
    }, {});
    return output;
  } catch (error) {
    console.log(`Error getting install counts (${daysAgo} days ago): ${error}`);
    return {};
  }
}
