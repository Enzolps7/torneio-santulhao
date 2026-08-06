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

-- ============================================================
-- Geração automática da fase final (meias-finais, final, 3º lugar)
-- Executar isto uma única vez no SQL Editor do Supabase.
-- Corre inteiramente no servidor: funciona mesmo que ninguém
-- tenha o site aberto no browser quando o último resultado é gravado.
-- ============================================================

-- Colunas usadas para mostrar "1º Grupo A", "Vencedor SF1", etc.
-- antes/depois dos jogos serem atribuídos.
alter table matches add column if not exists placeholder1 text;
alter table matches add column if not exists placeholder2 text;

-- Classificação de um grupo (pontos, diferença de golos, golos marcados)
create or replace function group_standings(g text)
returns table(team_id uuid, pts bigint, gd bigint, gm bigint) as $$
  with team_matches as (
    select m.team1_id as team_id, m.score1 as gf, m.score2 as ga
    from matches m where m.stage = 'group' and m.group_name = g and m.played
    union all
    select m.team2_id as team_id, m.score2 as gf, m.score1 as ga
    from matches m where m.stage = 'group' and m.group_name = g and m.played
  )
  select team_id,
    sum(case when gf > ga then 3 when gf = ga then 1 else 0 end)::bigint as pts,
    (sum(gf) - sum(ga))::bigint as gd,
    sum(gf)::bigint as gm
  from team_matches
  group by team_id
  order by pts desc, gd desc, gm desc;
$$ language sql stable;

-- Quando o último jogo de grupo é marcado como "played", gera as duas
-- meias-finais (1º A vs 2º B, 1º B vs 2º A), se ainda não existirem.
create or replace function generate_semis_if_ready() returns trigger as $$
declare
  remaining int;
  existing_semis int;
  a_teams uuid[];
  b_teams uuid[];
begin
  select count(*) into remaining from matches where stage = 'group' and played = false;
  if remaining > 0 then
    return NEW;
  end if;

  select count(*) into existing_semis from matches where stage = 'semi';
  if existing_semis > 0 then
    return NEW;
  end if;

  select array_agg(team_id) into a_teams from group_standings('A');
  select array_agg(team_id) into b_teams from group_standings('B');

  if a_teams is null or b_teams is null or array_length(a_teams, 1) < 2 or array_length(b_teams, 1) < 2 then
    return NEW;
  end if;

  -- Cria já a Final e o jogo de 3º Lugar, sem equipas atribuídas,
  -- para que o admin possa definir a hora destes jogos desde já.
  insert into matches (stage, semi_slot, team1_id, team2_id, placeholder1, placeholder2)
  values
    ('semi', 'semi1', a_teams[1], b_teams[2], '1º A', '2º B'),
    ('semi', 'semi2', b_teams[1], a_teams[2], '1º B', '2º A'),
    ('final', null, null, null, 'Vencedor SF1', 'Vencedor SF2'),
    ('third_place', null, null, null, 'Perdedor SF1', 'Perdedor SF2');

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_generate_semis on matches;
create trigger trg_generate_semis
  after update of played on matches
  for each row
  when (NEW.stage = 'group' and NEW.played = true)
  execute function generate_semis_if_ready();

-- Assim que uma meia-final é concluída, coloca imediatamente o nome
-- do vencedor na Final e o do perdedor na Petite Final (3º lugar) —
-- sem esperar que a outra meia-final também termine.
drop trigger if exists trg_generate_final on matches;
drop function if exists generate_final_if_ready();

create or replace function fill_final_teams() returns trigger as $$
declare
  winner uuid;
  loser uuid;
begin
  if NEW.score1 is null or NEW.score2 is null or NEW.score1 = NEW.score2 then
    return NEW;
  end if;

  winner := case when NEW.score1 > NEW.score2 then NEW.team1_id else NEW.team2_id end;
  loser  := case when NEW.score1 > NEW.score2 then NEW.team2_id else NEW.team1_id end;

  if NEW.semi_slot = 'semi1' then
    update matches set team1_id = winner where stage = 'final';
    update matches set team1_id = loser where stage = 'third_place';
  elsif NEW.semi_slot = 'semi2' then
    update matches set team2_id = winner where stage = 'final';
    update matches set team2_id = loser where stage = 'third_place';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_fill_final_teams on matches;
create trigger trg_fill_final_teams
  after update of played on matches
  for each row
  when (NEW.stage = 'semi' and NEW.played = true)
  execute function fill_final_teams();
