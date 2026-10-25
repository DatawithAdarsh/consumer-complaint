-- =====================================================================
-- Complaint Board: database schema, security rules, ranking view, seed
-- Run this whole file once in Supabase Dashboard -> SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------------------------------------------------
create table if not exists public.categories (
  id    serial primary key,
  slug  text not null unique,
  name  text not null
);

create table if not exists public.companies (
  id          serial primary key,
  name        text not null check (char_length(name) between 2 and 80),
  category_id int  not null references public.categories(id),
  created_at  timestamptz not null default now()
);
create unique index if not exists companies_name_unique on public.companies (lower(name));

create table if not exists public.complaints (
  id          uuid primary key default gen_random_uuid(),
  company_id  int  not null references public.companies(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  issue_type  text not null check (char_length(issue_type) between 2 and 60),
  title       text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 2000),
  severity    smallint not null check (severity between 1 and 5),
  resolved    boolean not null default false,
  status      text not null default 'approved' check (status in ('approved','rejected')),
  created_at  timestamptz not null default now()
);
create index if not exists complaints_company_idx on public.complaints (company_id, status);
create index if not exists complaints_user_idx    on public.complaints (user_id, created_at);

-- ---------- Anti-spam: max 5 complaints per user per 24h ---------------
create or replace function public.limit_complaints_per_day() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.complaints
        where user_id = new.user_id
          and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Daily complaint limit reached (5). Please try again tomorrow.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_limit_complaints on public.complaints;
create trigger trg_limit_complaints before insert on public.complaints
  for each row execute function public.limit_complaints_per_day();

-- ---------- Row Level Security ----------------------------------------
alter table public.categories enable row level security;
alter table public.companies  enable row level security;
alter table public.complaints enable row level security;

drop policy if exists "categories readable" on public.categories;
create policy "categories readable" on public.categories for select using (true);

drop policy if exists "companies readable" on public.companies;
create policy "companies readable" on public.companies for select using (true);

drop policy if exists "companies insert by signed-in" on public.companies;
create policy "companies insert by signed-in" on public.companies
  for insert to authenticated with check (true);

-- Raw complaints (which contain user_id) are visible only to their author.
drop policy if exists "own complaints select" on public.complaints;
create policy "own complaints select" on public.complaints
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own complaints insert" on public.complaints;
create policy "own complaints insert" on public.complaints
  for insert to authenticated with check (user_id = auth.uid() and status = 'approved');

drop policy if exists "own complaints delete" on public.complaints;
create policy "own complaints delete" on public.complaints
  for delete to authenticated using (user_id = auth.uid());

-- ---------- Column-level grants (users can't forge status/created_at) --
revoke all on public.categories, public.companies, public.complaints from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.companies  to anon, authenticated;
grant insert (name, category_id) on public.companies to authenticated;
grant usage, select on sequence public.companies_id_seq to authenticated;
grant select, delete on public.complaints to authenticated;
grant insert (company_id, issue_type, title, description, severity, resolved)
  on public.complaints to authenticated;

-- ---------- Public views (no user_id leaks) ---------------------------
create or replace view public.public_complaints as
  select id, company_id, issue_type, title, description, severity, resolved, created_at
  from public.complaints
  where status = 'approved';

-- Ranking model (documented on the site too):
--   resolution_smoothed = (resolved + 2.5) / (n + 5)          -- prior: 50% resolved
--   severity_smoothed   = (sum_severity + 3*5) / (n + 5)       -- prior: severity 3
--   score = 100 * resolution_smoothed * (1 - (severity_smoothed - 1) / 8)
-- The "+5 pseudo-complaints" prior stops a company with 1 complaint jumping
-- to the top/bottom. Companies with fewer than 3 complaints are left unranked.
create or replace view public.company_rankings as
with agg as (
  select
    co.id            as company_id,
    co.name          as company_name,
    cat.id           as category_id,
    cat.slug         as category_slug,
    cat.name         as category_name,
    count(c.id)::int as total_complaints,
    count(c.id) filter (where c.resolved)::int as resolved_count,
    count(c.id) filter (where c.created_at > now() - interval '90 days')::int as recent_complaints,
    coalesce(round(avg(c.severity)::numeric, 2), 0) as avg_severity,
    coalesce(sum(c.severity), 0)::numeric as sum_severity
  from public.companies co
  join public.categories cat on cat.id = co.category_id
  left join public.complaints c on c.company_id = co.id and c.status = 'approved'
  group by co.id, co.name, cat.id, cat.slug, cat.name
),
scored as (
  select *,
    round(
      100 * ((resolved_count + 2.5) / (total_complaints + 5.0))
          * (1 - (((sum_severity + 15.0) / (total_complaints + 5.0)) - 1) / 8.0)
    , 1) as score
  from agg
)
select *,
  case when total_complaints >= 3
       then rank() over (partition by category_id
                         order by (case when total_complaints >= 3 then score end) desc nulls last)
  end as rank_in_category
from scored;

grant select on public.public_complaints, public.company_rankings to anon, authenticated;

-- ---------- Seed data --------------------------------------------------
insert into public.categories (slug, name) values
  ('health-insurance', 'Health Insurance'),
  ('ecommerce',        'E-commerce Apps'),
  ('grocery-delivery', 'Grocery Delivery'),
  ('food-delivery',    'Food Delivery'),
  ('telecom',          'Telecom')
on conflict (slug) do nothing;

insert into public.companies (name, category_id)
select v.name, c.id from (values
  ('Star Health',            'health-insurance'),
  ('HDFC ERGO',              'health-insurance'),
  ('Niva Bupa',              'health-insurance'),
  ('Care Health',            'health-insurance'),
  ('ICICI Lombard',          'health-insurance'),
  ('Bajaj Allianz',          'health-insurance'),
  ('Digit Insurance',        'health-insurance'),
  ('Acko',                   'health-insurance'),
  ('Amazon',                 'ecommerce'),
  ('Flipkart',               'ecommerce'),
  ('Myntra',                 'ecommerce'),
  ('Meesho',                 'ecommerce'),
  ('Ajio',                   'ecommerce'),
  ('Nykaa',                  'ecommerce'),
  ('Blinkit',                'grocery-delivery'),
  ('Zepto',                  'grocery-delivery'),
  ('BigBasket',              'grocery-delivery'),
  ('Swiggy Instamart',       'grocery-delivery'),
  ('JioMart',                'grocery-delivery'),
  ('Swiggy',                 'food-delivery'),
  ('Zomato',                 'food-delivery'),
  ('Jio',                    'telecom'),
  ('Airtel',                 'telecom'),
  ('Vi (Vodafone Idea)',     'telecom'),
  ('BSNL',                   'telecom')
) as v(name, slug)
join public.categories c on c.slug = v.slug
on conflict do nothing;
