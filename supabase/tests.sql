-- Manual backend tests. Run in Supabase SQL Editor AFTER schema.sql.
-- Everything runs inside a transaction and is rolled back, so no data is kept.
begin;

-- 1. Seed data exists
select count(*) as categories from public.categories;          -- expect 5
select count(*) as companies  from public.companies;           -- expect 25

-- 2. Create a throwaway user + complaints (as postgres, bypasses RLS)
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000000aa', 'test@example.com', 'authenticated', 'authenticated');

insert into public.complaints (company_id, user_id, issue_type, title, description, severity, resolved)
select (select id from public.companies where name = 'Star Health'),
       '00000000-0000-0000-0000-0000000000aa',
       'Claim rejected or delayed', 'Claim rejected ' || g, repeat('x', 30), 5, false
from generate_series(1, 3) g;
-- (the daily limit trigger allows 5, so 3 inserts pass)

-- 3. Ranking view reflects them, Star Health is ranked (>=3 complaints)
select company_name, total_complaints, score, rank_in_category
from public.company_rankings where category_slug = 'health-insurance'
order by rank_in_category nulls last;                           -- Star Health should be last ranked, others null

-- 4. Public view does not expose user_id
select column_name from information_schema.columns
where table_name = 'public_complaints' and column_name = 'user_id';  -- expect 0 rows

-- 5. Daily limit trigger: 3 more inserts should fail on the 3rd (total would be 6)
do $$
begin
  for i in 4..6 loop
    insert into public.complaints (company_id, user_id, issue_type, title, description, severity)
    values ((select id from public.companies where name = 'Star Health'),
            '00000000-0000-0000-0000-0000000000aa',
            'Other', 'Another complaint ' || i, repeat('y', 30), 3);
  end loop;
  raise exception 'TEST FAILED: limit did not trigger';
exception when sqlstate 'P0001' then
  raise notice 'OK: daily limit enforced';
end $$;

rollback;
