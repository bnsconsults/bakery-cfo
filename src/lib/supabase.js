import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

/* ─────────────────────────────────────────────────────────────
   PASTE THIS SQL INTO SUPABASE → SQL EDITOR → RUN
   Sets up all tables your SaaS needs, one bakery per user.
─────────────────────────────────────────────────────────────

-- Enable RLS (Row Level Security) so each user only sees their own data

create table if not exists public.daily_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  entry_date date not null default current_date,
  revenue numeric default 0,
  ingredient_cost numeric default 0,
  labor_cost numeric default 0,
  waste_value numeric default 0,
  notes text,
  created_at timestamptz default now()
);
alter table public.daily_entries enable row level security;
create policy "Users see own entries" on public.daily_entries
  for all using (auth.uid() = user_id);

create table if not exists public.ingredients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  stock numeric default 0,
  unit text default 'kg',
  reorder_level numeric default 5,
  cost_per_unit numeric default 0,
  expiry_date date,
  supplier text,
  created_at timestamptz default now()
);
alter table public.ingredients enable row level security;
create policy "Users see own ingredients" on public.ingredients
  for all using (auth.uid() = user_id);

create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  sell_price numeric default 0,
  ingredient_cost numeric default 0,
  batch_size integer default 10,
  prep_minutes integer default 30,
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.products enable row level security;
create policy "Users see own products" on public.products
  for all using (auth.uid() = user_id);

create table if not exists public.sales_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  product_id uuid references public.products,
  product_name text,
  sale_date date default current_date,
  units_sold integer default 0,
  units_wasted integer default 0,
  channel text default 'walk-in',
  created_at timestamptz default now()
);
alter table public.sales_log enable row level security;
create policy "Users see own sales" on public.sales_log
  for all using (auth.uid() = user_id);

create table if not exists public.staff (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  role text,
  hourly_rate numeric default 12500,
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.staff enable row level security;
create policy "Users see own staff" on public.staff
  for all using (auth.uid() = user_id);

create table if not exists public.labor_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  staff_id uuid references public.staff,
  staff_name text,
  log_date date default current_date,
  hours_worked numeric default 8,
  overtime_hours numeric default 0,
  created_at timestamptz default now()
);
alter table public.labor_log enable row level security;
create policy "Users see own labor" on public.labor_log
  for all using (auth.uid() = user_id);

create table if not exists public.bakery_profile (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null unique,
  bakery_name text default 'My Bakery',
  location text,
  currency text default 'UGX',
  labor_threshold numeric default 35,
  waste_threshold numeric default 8,
  created_at timestamptz default now()
);
alter table public.bakery_profile enable row level security;
create policy "Users see own profile" on public.bakery_profile
  for all using (auth.uid() = user_id);

*/
