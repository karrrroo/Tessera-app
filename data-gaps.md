# Data gaps found by `npm run data:audit`

Read-only audit. Nothing below was inserted — this file lists what's missing
and, where there's an obvious fix, the INSERT/UPDATE that would create it.
`npm run data:topup` runs exactly these, but only when explicitly instructed.

## departed student

no departed enrollment with published marks exists

```sql
update enrollment set status = 'departed' where id = (select id from enrollment where status = 'active' limit 1);
```

## tagged assessment

no assessment has a non-null topic — tessera-seed.sql never sets this column at all (PRD Q8/REC-10 is exactly this open question)

```sql
update assessment set topic = 'Sample topic' where id = (select id from assessment order by random() limit 1);
```
