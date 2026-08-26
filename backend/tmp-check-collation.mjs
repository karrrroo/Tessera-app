import pg from "pg";
const pool = new pg.Pool({ connectionString: "postgresql://tessera:tessera_dev_password@localhost:5433/tessera_dev" });
const q = async (sql, params) => (await pool.query(sql, params)).rows;
try {
  console.log(await q("select 'a' collate \"hy-AM\" as x"));
  console.log("hy-AM collation OK");
} catch (e) {
  console.log("hy-AM ERROR:", e.message);
}
console.log(await q("select collname from pg_collation where collname ilike '%hy%' or collname ilike '%arm%'"));
console.log(await q("show lc_collate"));
console.log(await q("select version()"));
await pool.end();
