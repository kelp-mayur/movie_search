const fs = require("fs");
const path = require("path");

async function* getLines(stream) {
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk;
    let pos;
    while ((pos = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, pos);
      buffer = buffer.slice(pos + 1);
      yield line;
    }
  }
  if (buffer.trim().length > 0) {
    yield buffer;
  }
}

async function createPhysicalIndex(esBaseUrl, indexName, mappingPath) {
  const indexUrl = `${esBaseUrl}/${indexName}`;
  if (!fs.existsSync(mappingPath)) {
    throw new Error(`Mapping definition file not found at: ${mappingPath}`);
  }

  console.log(`Creating physical index "${indexName}" using custom analyzers from: ${mappingPath}...`);
  const mappingData = fs.readFileSync(mappingPath, "utf-8");
  const createRes = await fetch(indexUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: mappingData,
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create index "${indexName}": ${err}`);
  }
  console.log(`✅ Physical index "${indexName}" created successfully.`);
}

async function swapAlias(esBaseUrl, aliasName, physicalIndex) {
  console.log(`\nInitiating zero-downtime atomic alias swap for "${aliasName}" -> "${physicalIndex}"...`);

  // 1. Check if aliasName already exists as a concrete index (not an alias)
  try {
    const checkRes = await fetch(`${esBaseUrl}/${aliasName}`, { method: "GET" });
    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data[aliasName] && !data[aliasName].aliases?.[aliasName]) {
        console.warn(
          `⚠️ Note: A concrete index named "${aliasName}" already exists. ` +
          `Alias operations will target the alias pointer. If using same name, consider removing or renaming the concrete index.`
        );
      }
    }
  } catch {
    // ES not reachable or other network issue
  }

  // 2. Discover previous indices pointing to this alias
  const oldIndices = [];
  try {
    const aliasRes = await fetch(`${esBaseUrl}/_alias/${aliasName}`, { method: "GET" });
    if (aliasRes.ok) {
      const aliasData = await aliasRes.json();
      oldIndices.push(...Object.keys(aliasData));
    }
  } catch {
    // Alias does not exist yet
  }

  // 3. Atomically detach old indices and attach new physical index
  const actions = [];
  for (const oldIndex of oldIndices) {
    actions.push({ remove: { index: oldIndex, alias: aliasName } });
  }
  actions.push({ add: { index: physicalIndex, alias: aliasName } });

  const swapRes = await fetch(`${esBaseUrl}/_aliases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actions }),
  });

  if (!swapRes.ok) {
    const err = await swapRes.text();
    throw new Error(`Failed to atomically swap alias "${aliasName}": ${err}`);
  }

  console.log(`🎉 [Blue/Green Swap Complete] Alias "${aliasName}" is now live on index "${physicalIndex}".`);
  if (oldIndices.length > 0) {
    console.log(`   Replaced previous index(es): [${oldIndices.join(", ")}].`);
  }
}

async function bulkIngest(
  filePath = path.join(__dirname, "movies_bulk-2.ndjson"),
  esBaseUrl = process.env.ELASTICSEARCH_API
    ? process.env.ELASTICSEARCH_API.replace(/\/$/, "")
    : "http://localhost:9200"
) {
  const targetAlias = process.env.INDEX || process.env.ALIAS || "imdbmovies_alias";
  const physicalIndex = `imdbmovies_${Date.now()}`;
  const mappingPath = path.join(__dirname, "mapping.json");
  const esUrl = `${esBaseUrl}/_bulk`;

  console.log(`Starting Blue/Green bulk ingestion from: ${filePath}`);
  console.log(`Target Elasticsearch URL: ${esUrl}`);
  console.log(`Target Alias: "${targetAlias}"`);
  console.log(`New Physical Target Index: "${physicalIndex}"`);

  // Step 1: Create new physical index with linguistic mapping and analyzers
  await createPhysicalIndex(esBaseUrl, physicalIndex, mappingPath);

  // Step 2: Stream NDJSON and bulk insert in chunks of 1,000 docs (2,000 lines)
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  let batch = [];
  const BATCH_LINES = 2000;
  let batchCount = 0;
  let totalDocs = 0;

  for await (const rawLine of getLines(stream)) {
    // Sanitize Unicode line/paragraph separators (U+2028, U+2029)
    let line = rawLine.replace(/[\u2028\u2029]/g, " ").trim();
    if (!line) continue;

    if (line.startsWith('{"index":')) {
      line = line.replace(/"_index":\s*"[^"]+"/, `"_index": "${physicalIndex}"`);
    }

    batch.push(line);

    if (batch.length >= BATCH_LINES) {
      batchCount++;
      await sendBatch(esUrl, batch.join("\n") + "\n", batchCount, batch.length / 2);
      totalDocs += batch.length / 2;
      batch = [];
    }
  }

  if (batch.length > 0) {
    batchCount++;
    await sendBatch(esUrl, batch.join("\n") + "\n", batchCount, batch.length / 2);
    totalDocs += batch.length / 2;
  }

  // Step 3: Refresh the physical index so all segments are flushed to searchable storage
  console.log(`\nRefreshing index "${physicalIndex}"...`);
  await fetch(`${esBaseUrl}/${physicalIndex}/_refresh`, { method: "POST" });

  // Step 4: Perform atomic Blue/Green alias swap
  await swapAlias(esBaseUrl, targetAlias, physicalIndex);

  console.log(`\n✨ Ingestion completed cleanly! Total ${totalDocs} documents across ${batchCount} batches.`);
}

async function sendBatch(url, body, batchNum, docCount) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson" },
    body,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`HTTP ${res.status} on batch ${batchNum}: ${errorBody}`);
  }

  const data = await res.json();
  if (data.errors) {
    const failedItems = data.items.filter((i) => i.index && i.index.error);
    console.error(
      `⚠️ Batch ${batchNum} had ${failedItems.length} item errors. Sample error:`,
      JSON.stringify(failedItems[0].index.error)
    );
  } else {
    process.stdout.write(`Batch ${batchNum} sent (${docCount} docs)...\r`);
  }
}

const targetFile = process.argv[2] || path.join(__dirname, "movies_bulk-2.ndjson");
bulkIngest(targetFile).catch((err) => {
  console.error("\n❌ Ingestion failed:", err.message);
  process.exit(1);
});
