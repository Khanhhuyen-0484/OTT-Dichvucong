const { readJson, putAll } = require("./_helpers");

async function migrateDossiers() {
  const tableName = process.env.DYNAMODB_DOSSIERS_TABLE || "Dossiers";
  const data = await readJson("admin_data.json", { dossiers: [] });
  const dossiers = Array.isArray(data.dossiers) ? data.dossiers : [];
  await putAll(tableName, dossiers);
  console.log(`[migrate] Dossiers: ${dossiers.length} records -> ${tableName}`);
}

module.exports = { migrateDossiers };

if (require.main === module) {
  migrateDossiers().catch((err) => {
    console.error("[migrate] Dossiers failed:", err.message);
    process.exit(1);
  });
}
