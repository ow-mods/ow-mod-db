const CLOUDFLARE_ACCOUNT_ID = "e6aa0d3aeb9351742a2acc8082febc56";

export async function getInstallCounts(
  daysAgo: number,
  cloudflareApiToken: string,
) {
  try {
    const query = `
      SELECT blob3, count() as count
      FROM event_counter_analytics
      WHERE blob2 = 'ModInstall'
        AND blob3 IS NOT NULL
        AND timestamp >= NOW() - INTERVAL '${daysAgo}' DAY
      GROUP BY blob3
      FORMAT JSONEachRow
    `;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cloudflareApiToken}`,
          "Content-Type": "text/plain",
        },
        body: query,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.log(`Analytics Engine API error (${response.status}): ${text}`);
      return {};
    }

    const text = await response.text();
    const lines = text.trim().split("\n").filter(Boolean);

    const output: Record<string, number> = {};
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        if (row.blob3) {
          const data = JSON.parse(row.blob3);
          const modUniqueName = data.mod_unique_name;
          if (modUniqueName) {
            output[modUniqueName] =
              (output[modUniqueName] ?? 0) + Number(row.count);
          }
        }
      } catch {
        // skip malformed rows
      }
    }

    return output;
  } catch (error) {
    console.log(`Error getting install counts (${daysAgo} days ago): ${error}`);
    return {};
  }
}
