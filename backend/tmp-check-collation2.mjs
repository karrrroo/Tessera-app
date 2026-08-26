import pg from "pg";
const pool = new pg.Pool({ connectionString: "postgresql://tessera:tessera_dev_password@localhost:5433/tessera_dev" });
const q = async (sql, params) => (await pool.query(sql, params)).rows;
const r = await q(`select unnest(array['Ցոլակյան','Ղազարյան','Մկրտչյան']) as name order by name collate "hy-AM"`);
console.log(r);
await pool.end();
