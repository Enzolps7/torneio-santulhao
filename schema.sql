-- Torneio de Santulhão 2026 — esquema da base de dados (Supabase / Postgres)
-- Executar isto uma única vez no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_name text not null check (group_name in ('A', 'B')),
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('group', 'semi', 'third_place', 'final')),
  group_name text check (group_name in ('A', 'B')),
  semi_slot text check (semi_slot in ('semi1', 'semi2')),
  team1_id uuid references teams(id) on delete set null,
  team2_id uuid references teams(id) on delete set null,
  scheduled_at timestamptz,
  venue text,
  score1 int,
  score2 int,
  played boolean not null default false,
  created_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table goals enable row level security;

-- Leitura pública para todos (qualquer pessoa com o link vê tudo)
create policy "public read teams" on teams for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read goals" on goals for select using (true);

-- Escrita apenas para o administrador autenticado
create policy "admin write teams" on teams for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write players" on players for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write matches" on matches for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write goals" on goals for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime (para que os resultados apareçam ao vivo para todos)
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table goals;
