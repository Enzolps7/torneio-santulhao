// Bundle complet du Torneio de Santulhão
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://bwseriegvtvjidbacwsa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3c2VyaWVndnR2amlkYmFjd3NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzQwOTEsImV4cCI6MjEwMTI1MDA5MX0.fiddoMRn4I0E8gXwd6FMsa25xBW4i-_w5MmTfyCw6Ac";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STAGE_LABELS = { group: "Fase de Grupos", semi: "Meia-Final", third_place: "3º Lugar", final: "Final" };

function formatDateTime(iso) {
  if (!iso) return "Data por marcar";
  const d = new Date(iso);
  return d.toLocaleString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isoToLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputValueToIso(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function teamLabel(team) {
  return team ? escapeHtml(team.name) : "Por definir";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function goalsForMatch(match) {
  return (match.goals || []).map((g) => (g.players ? g.players.name : null)).filter(Boolean);
}

function computeStandings(teams, matches, groupName) {
  const groupTeams = teams.filter((t) => t.group_name === groupName);
  const table = {};
  for (const t of groupTeams) {
    table[t.id] = { team: t, pj: 0, v: 0, e: 0, d: 0, gm: 0, gs: 0, gd: 0, pts: 0 };
  }
  const groupMatches = matches.filter((m) => m.stage === "group" && m.group_name === groupName && m.played);
  for (const m of groupMatches) {
    const r1 = table[m.team1_id];
    const r2 = table[m.team2_id];
    if (!r1 || !r2) continue;
    r1.pj++;
    r2.pj++;
    r1.gm += m.score1;
    r1.gs += m.score2;
    r2.gm += m.score2;
    r2.gs += m.score1;
    if (m.score1 > m.score2) {
      r1.v++;
      r1.pts += 3;
      r2.d++;
    } else if (m.score1 < m.score2) {
      r2.v++;
      r2.pts += 3;
      r1.d++;
    } else {
      r1.e++;
      r2.e++;
      r1.pts += 1;
      r2.pts += 1;
    }
  }
  const rows = Object.values(table);
  rows.forEach((r) => (r.gd = r.gm - r.gs));
  rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gm - a.gm || a.team.name.localeCompare(b.team.name));
  return rows;
}

function computeTopScorers(matches) {
  const counts = {};
  for (const m of matches) {
    for (const g of m.goals || []) {
      if (!g.player_id || !g.players) continue;
      if (!counts[g.player_id]) counts[g.player_id] = { player: g.players, teamId: g.team_id, goals: 0 };
      counts[g.player_id].goals++;
    }
  }
  return Object.values(counts).sort((a, b) => b.goals - a.goals || a.player.name.localeCompare(b.player.name));
}

function standingsTable(rows, groupName) {
  if (rows.length === 0) return `<p class="empty-hint">Ainda sem equipas no Grupo ${groupName}.</p>`;
  const trs = rows.map((r, i) => `<tr class="${i === 0 ? "rank-1" : i === 1 ? "rank-2" : ""}"><td>${escapeHtml(r.team.name)}</td><td>${r.pj}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.gm}</td><td>${r.gs}</td><td>${r.gd}</td><td><strong>${r.pts}</strong></td></tr>`).join("");
  return `<table><thead><tr><th>Equipa</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>DG</th><th>Pts</th></tr></thead><tbody>${trs}</tbody></table>`;
}

function renderStandings(teams, matches) {
  const standingsA = computeStandings(teams, matches, "A");
  const standingsB = computeStandings(teams, matches, "B");
  return `<div class="card"><h2>Classificação</h2><div class="groups-grid"><div><h3>Grupo A</h3>${standingsTable(standingsA, "A")}</div><div><h3>Grupo B</h3>${standingsTable(standingsB, "B")}</div></div><p class="empty-hint" style="margin-top:10px;">O 1º de cada grupo defronta o 2º do grupo adversário nas meias-finais.</p></div>`;
}

function matchRow(m) {
  const scoreHtml = m.played ? `<span class="score-badge">${m.score1} - ${m.score2}</span>` : `<span class="score-badge">vs</span>`;
  const scorers = goalsForMatch(m);
  const scorersLine = scorers.length ? `<div class="scorers-line">⚽ ${scorers.map(escapeHtml).join(", ")}</div>` : "";
  return `<div class="match-row"><div class="match-teams"><span class="team">${teamLabel(m.team1)}</span>${scoreHtml}<span class="team right">${teamLabel(m.team2)}</span></div><div class="match-meta">${formatDateTime(m.scheduled_at)}${m.venue ? " · " + escapeHtml(m.venue) : ""}</div>${scorersLine}</div>`;
}

function renderCalendar(matches) {
  const groupA = matches.filter((m) => m.stage === "group" && m.group_name === "A");
  const groupB = matches.filter((m) => m.stage === "group" && m.group_name === "B");
  const knockout = matches.filter((m) => m.stage !== "group");
  return `${groupA.length ? `<div class="card"><h2>Grupo A — Calendário</h2>${groupA.map(matchRow).join("")}</div>` : `<div class="card"><h2>Grupo A — Calendário</h2><p class="empty-hint">Calendário gerado assim que o grupo tiver 4 equipas.</p></div>`}${groupB.length ? `<div class="card"><h2>Grupo B — Calendário</h2>${groupB.map(matchRow).join("")}</div>` : `<div class="card"><h2>Grupo B — Calendário</h2><p class="empty-hint">Calendário gerado assim que o grupo tiver 4 equipas.</p></div>`}`;
}

function renderBracket(matches) {
  const semi1 = matches.find((m) => m.stage === "semi" && m.semi_slot === "semi1");
  const semi2 = matches.find((m) => m.stage === "semi" && m.semi_slot === "semi2");
  const final = matches.find((m) => m.stage === "final");
  const third = matches.find((m) => m.stage === "third_place");
  const box = (m, label) => m ? `<div class="card">${matchRow(m)}</div>` : `<div class="card"><p class="empty-hint">${label}</p></div>`;
  return `<div class="card"><h2>Fase Final</h2><div class="bracket"><div class="bracket-round"><h3>Meias-Finais</h3><div class="bracket-matches two-col">${box(semi1, "1º Grupo A vs 2º Grupo B — a definir no final da fase de grupos")}${box(semi2, "1º Grupo B vs 2º Grupo A — a definir no final da fase de grupos")}</div></div><div class="bracket-round"><h3>3º Lugar &amp; Final</h3><div class="bracket-matches two-col">${box(third, "Vencidos das meias-finais — a definir")}${box(final, "Vencedores das meias-finais — a definir")}</div></div></div></div>`;
}

function renderScorers(matches) {
  const scorers = computeTopScorers(matches);
  if (scorers.length === 0) return `<div class="card"><h2>Melhores Marcadores</h2><p class="empty-hint">Ainda não há golos registados.</p></div>`;
  const trs = scorers.map((s, i) => `<tr><td class="rank">${i + 1}º</td><td>${escapeHtml(s.player.name)}</td><td><strong>${s.goals}</strong></td></tr>`).join("");
  return `<div class="card"><h2>Melhores Marcadores</h2><table class="scorers-table"><thead><tr><th></th><th>Jogador</th><th>Golos</th></tr></thead><tbody>${trs}</tbody></table></div>`;
}

function renderLogin(errorMsg) {
  return `<div class="card login-box"><h2>Área de Administração</h2><form data-action="login-form"><input type="email" id="login-email" placeholder="Email" required autocomplete="username" /><input type="password" id="login-password" placeholder="Palavra-passe" required autocomplete="current-password" /><button class="btn" type="submit" style="width:100%;">Entrar</button>${errorMsg ? `<p class="error-msg">${escapeHtml(errorMsg)}</p>` : ""}</form></div>`;
}

function renderAdminTeams(teams) {
  const countA = teams.filter((t) => t.group_name === "A").length;
  const countB = teams.filter((t) => t.group_name === "B").length;
  const teamBlock = (t) => `<div class="admin-team-block"><h3>${escapeHtml(t.name)} <span style="font-size:0.75rem;opacity:0.7;">Grupo ${t.group_name}</span><button class="btn danger" style="padding:3px 9px;font-size:0.75rem;" data-action="delete-team" data-id="${t.id}">Remover equipa</button></h3><div>${(t.players || []).map((p) => `<span class="player-chip">${escapeHtml(p.name)}<button data-action="delete-player" data-id="${p.id}" title="Remover jogador">×</button></span>`).join("")}</div><form class="inline-form" style="margin-top:8px;" data-action="add-player-form" data-team="${t.id}"><input type="text" placeholder="Nome do jogador" required /><button class="btn secondary" type="submit">+ Jogador</button></form></div>`;
  return `<div class="card"><h2>Equipas</h2><form class="inline-form" data-action="add-team-form"><input type="text" id="new-team-name" placeholder="Nome da equipa" required /><select id="new-team-group"><option value="A" ${countA >= 4 ? "disabled" : ""}>Grupo A (${countA}/4)</option><option value="B" ${countB >= 4 ? "disabled" : ""}>Grupo B (${countB}/4)</option></select><button class="btn" type="submit">+ Adicionar equipa</button></form><div class="groups-grid"><div><h3>Grupo A (${countA}/4)</h3>${teams.filter((t) => t.group_name === "A").map(teamBlock).join("") || `<p class="empty-hint">Sem equipas.</p>`}</div><div><h3>Grupo B (${countB}/4)</h3>${teams.filter((t) => t.group_name === "B").map(teamBlock).join("") || `<p class="empty-hint">Sem equipas.</p>`}</div></div></div>`;
}

function renderAdminSchedule(matches) {
  if (matches.length === 0) return `<div class="card"><h2>Horários</h2><p class="empty-hint">Os jogos aparecem aqui assim que forem gerados (adicione 4 equipas a cada grupo).</p></div>`;
  const row = (m) => `<div class="match-row"><div class="match-teams"><span style="font-size:0.75rem;opacity:0.7;min-width:110px;">${STAGE_LABELS[m.stage]}${m.group_name ? " " + m.group_name : ""}</span><span class="team">${teamLabel(m.team1)} vs ${teamLabel(m.team2)}</span></div><form class="inline-form" data-action="save-schedule-form" data-match="${m.id}" style="margin:0;"><input type="datetime-local" name="scheduled_at" value="${isoToLocalInputValue(m.scheduled_at)}" /><input type="text" name="venue" placeholder="Local" value="${m.venue ? escapeHtml(m.venue) : ""}" style="width:120px;" /><button class="btn secondary" type="submit">Guardar</button></form></div>`;
  return `<div class="card"><h2>Horários dos Jogos</h2>${matches.map(row).join("")}</div>`;
}

function goalRowHtml(match, teamId, playerId) {
  const team1Id = match.team1_id;
  const team2Id = match.team2_id;
  const teamOptions = `<option value="${team1Id}" ${teamId === team1Id ? "selected" : ""}>${teamLabel(match.team1)}</option><option value="${team2Id}" ${teamId === team2Id ? "selected" : ""}>${teamLabel(match.team2)}</option>`;
  const players = (teamId === team1Id ? match.team1?.players : match.team2?.players) || [];
  const playerOptions = players.map((p) => `<option value="${p.id}" ${p.id === playerId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
  return `<div class="goal-row"><select class="goal-team-select">${teamOptions}</select><select class="goal-player-select">${playerOptions || '<option value="">(sem jogadores)</option>'}</select><button type="button" class="btn danger" style="padding:3px 9px;" data-action="remove-goal-row">×</button></div>`;
}

function renderAdminResults(matches, teamsById) {
  const matchesWithPlayers = matches.map((m) => ({ ...m, team1: m.team1 ? { ...m.team1, players: teamsById[m.team1.id]?.players || [] } : null, team2: m.team2 ? { ...m.team2, players: teamsById[m.team2.id]?.players || [] } : null }));
  if (matchesWithPlayers.length === 0) return `<div class="card"><h2>Resultados</h2><p class="empty-hint">Sem jogos gerados ainda.</p></div>`;
  const block = (m) => {
    const goalRows = (m.goals || []).map((g) => goalRowHtml(m, g.team_id, g.player_id)).join("");
    return `<div class="card"><div class="match-teams" style="margin-bottom:6px;"><span style="font-size:0.75rem;opacity:0.7;min-width:110px;">${STAGE_LABELS[m.stage]}${m.group_name ? " " + m.group_name : ""}</span><span class="team">${teamLabel(m.team1)} vs ${teamLabel(m.team2)}</span>${m.played ? '<span class="badge-live">Jogado</span>' : ""}</div><form class="result-form" data-action="save-result-form" data-match="${m.id}"><div class="score-inputs"><span>${teamLabel(m.team1)}</span><input type="number" min="0" name="score1" value="${m.score1 ?? ""}" required /><span>—</span><input type="number" min="0" name="score2" value="${m.score2 ?? ""}" required /><span>${teamLabel(m.team2)}</span></div><div><div class="goal-rows" data-match-ref="${m.id}">${goalRows}</div><button type="button" class="btn secondary" style="margin-top:6px;" data-action="add-goal-row" data-match="${m.id}">+ Golo</button></div><div style="display:flex;gap:8px;"><button class="btn" type="submit">Guardar resultado</button>${m.played ? `<button type="button" class="btn danger" data-action="reset-result" data-id="${m.id}">Repor</button>` : ""}</div></form></div>`;
  };
  return `<h2 style="color:var(--gold-light);">Resultados</h2>${matchesWithPlayers.map(block).join("")}`;
}

const state = { session: null, teams: [], matches: [], tab: "standings", loginError: null, loading: true };
const PUBLIC_TABS = [
  { id: "standings", label: "Classificação" },
  { id: "calendar", label: "Calendário" },
  { id: "bracket", label: "Fase Final" },
  { id: "scorers", label: "Marcadores" },
];
const ADMIN_TABS = [
  { id: "admin-teams", label: "Equipas" },
  { id: "admin-schedule", label: "Horários" },
  { id: "admin-results", label: "Resultados" },
];

const appRoot = document.getElementById("app");

function teamsById() {
  return Object.fromEntries(state.teams.map((t) => [t.id, t]));
}

async function fetchTeams() {
  const { data, error } = await supabase.from("teams").select("*, players(*)").order("group_name").order("name");
  if (error) throw error;
  return data;
}

async function fetchMatches() {
  const { data, error } = await supabase.from("matches").select("*, team1:team1_id(id,name,group_name), team2:team2_id(id,name,group_name), goals(id, player_id, team_id, players(id,name))").order("stage").order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

async function loadAll() {
  const [teams, matches] = await Promise.all([fetchTeams(), fetchMatches()]);
  state.teams = teams;
  state.matches = matches;
}

function renderNav() {
  const tabs = state.session ? [...PUBLIC_TABS, ...ADMIN_TABS] : PUBLIC_TABS;
  const buttons = tabs.map((t) => `<button data-action="tab" data-tab="${t.id}" class="${state.tab === t.id ? "active" : ""}">${t.label}</button>`).join("");
  const authButton = state.session ? `<button data-action="logout" class="secondary" style="border-color:var(--gold);">Sair</button>` : `<button data-action="tab" data-tab="login" class="${state.tab === "login" ? "active" : ""}">Admin</button>`;
  return `<nav class="tabs">${buttons}${authButton}</nav>`;
}

function renderContent() {
  if (state.loading) return `<div class="card"><p class="empty-hint">A carregar...</p></div>`;
  switch (state.tab) {
    case "standings":
      return renderStandings(state.teams, state.matches);
    case "calendar":
      return renderCalendar(state.matches);
    case "bracket":
      return renderBracket(state.matches);
    case "scorers":
      return renderScorers(state.matches);
    case "login":
      return state.session ? renderStandings(state.teams, state.matches) : renderLogin(state.loginError);
    case "admin-teams":
      return state.session ? renderAdminTeams(state.teams) : renderLogin(state.loginError);
    case "admin-schedule":
      return state.session ? renderAdminSchedule(state.matches) : renderLogin(state.loginError);
    case "admin-results":
      return state.session ? renderAdminResults(state.matches, teamsById()) : renderLogin(state.loginError);
    default:
      return renderStandings(state.teams, state.matches);
  }
}

function render() {
  appRoot.innerHTML = `
    <header class="site-header">
      <h1>🏆 Torneio de Santulhão 2026</h1>
      <p>Santulhão · Portugal</p>
    </header>
    ${renderNav()}
    <main>${renderContent()}</main>
    <footer>Torneio de Santulhão 2026</footer>
  `;
}

function handleAddGoalRow(button) {
  const matchId = button.dataset.match;
  const match = state.matches.find((m) => m.id === matchId);
  if (!match) return;
  const byId = teamsById();
  const matchWithPlayers = {
    ...match,
    team1: match.team1 ? { ...match.team1, players: byId[match.team1.id]?.players || [] } : null,
    team2: match.team2 ? { ...match.team2, players: byId[match.team2.id]?.players || [] } : null,
  };
  const container = button.closest("form").querySelector(`.goal-rows[data-match-ref="${matchId}"]`);
  container.insertAdjacentHTML("beforeend", goalRowHtml(matchWithPlayers, match.team1_id, ""));
}

appRoot.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.tagName === "FORM") return;
  const action = el.dataset.action;
  try {
    if (action === "tab") {
      state.tab = el.dataset.tab;
      state.loginError = null;
      render();
    } else if (action === "logout") {
      await supabase.auth.signOut();
      state.tab = "standings";
      render();
    } else if (action === "delete-team") {
      if (confirm("Remover esta equipa e todos os seus jogadores?")) {
        await supabase.from("teams").delete().eq("id", el.dataset.id);
        await loadAll();
        render();
      }
    } else if (action === "delete-player") {
      if (confirm("Remover este jogador?")) {
        await supabase.from("players").delete().eq("id", el.dataset.id);
        await loadAll();
        render();
      }
    } else if (action === "reset-result") {
      if (confirm("Repor o resultado deste jogo? Os golos registados serão apagados.")) {
        await supabase.from("goals").delete().eq("match_id", el.dataset.id);
        await supabase.from("matches").update({ score1: null, score2: null, played: false }).eq("id", el.dataset.id);
        await loadAll();
        render();
      }
    } else if (action === "add-goal-row") {
      handleAddGoalRow(el);
    } else if (action === "remove-goal-row") {
      el.closest(".goal-row").remove();
    }
  } catch (err) {
    alert("Erro: " + err.message);
  }
});

appRoot.addEventListener("change", (e) => {
  if (!e.target.classList.contains("goal-team-select")) return;
  const row = e.target.closest(".goal-row");
  const form = e.target.closest("form[data-match]");
  const match = state.matches.find((m) => m.id === form.dataset.match);
  if (!match) return;
  const byId = teamsById();
  const newTeamId = e.target.value;
  const players = (newTeamId === match.team1_id ? byId[match.team1_id]?.players : byId[match.team2_id]?.players) || [];
  const playerSelect = row.querySelector(".goal-player-select");
  playerSelect.innerHTML = players.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("") || '<option value="">(sem jogadores)</option>';
});

appRoot.addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-action]");
  if (!form) return;
  e.preventDefault();
  const action = form.dataset.action;
  try {
    if (action === "login-form") {
      const email = form.querySelector("#login-email").value.trim();
      const password = form.querySelector("#login-password").value;
      try {
        await supabase.auth.signInWithPassword({ email, password });
        state.session = await supabase.auth.getSession();
        state.session = state.session.data.session;
        state.loginError = null;
        state.tab = "admin-teams";
        await loadAll();
        render();
      } catch (err) {
        state.loginError = "Credenciais inválidas.";
        render();
      }
    } else if (action === "add-team-form") {
      const name = form.querySelector("#new-team-name").value.trim();
      const group = form.querySelector("#new-team-group").value;
      if (!name) return;
      await supabase.from("teams").insert({ name, group_name: group });
      await loadAll();
      render();
    } else if (action === "add-player-form") {
      const teamId = form.dataset.team;
      const input = form.querySelector("input");
      const name = input.value.trim();
      if (!name) return;
      await supabase.from("players").insert({ team_id: teamId, name });
      await loadAll();
      render();
    } else if (action === "save-schedule-form") {
      const matchId = form.dataset.match;
      const scheduledAt = localInputValueToIso(form.scheduled_at.value);
      const venue = form.venue.value.trim();
      await supabase.from("matches").update({ scheduled_at: scheduledAt, venue: venue || null }).eq("id", matchId);
      await loadAll();
      render();
    } else if (action === "save-result-form") {
      const matchId = form.dataset.match;
      const match = state.matches.find((m) => m.id === matchId);
      const score1 = parseInt(form.score1.value, 10);
      const score2 = parseInt(form.score2.value, 10);
      if (Number.isNaN(score1) || Number.isNaN(score2)) return;
      if (match.stage !== "group" && score1 === score2) {
        alert("Na fase final não pode haver empate. Indique um vencedor.");
        return;
      }
      const goalRows = form.querySelectorAll(".goal-row");
      const goals = Array.from(goalRows).map((row) => ({ teamId: row.querySelector(".goal-team-select").value, playerId: row.querySelector(".goal-player-select").value || null }));
      await supabase.from("matches").update({ score1, score2, played: true }).eq("id", matchId);
      await supabase.from("goals").delete().eq("match_id", matchId);
      if (goals.length > 0) {
        const rows = goals.map((g) => ({ match_id: matchId, player_id: g.playerId || null, team_id: g.teamId }));
        await supabase.from("goals").insert(rows);
      }
      await loadAll();
      render();
    }
  } catch (err) {
    alert("Erro: " + err.message);
  }
});

async function init() {
  state.session = await supabase.auth.getSession();
  state.session = state.session.data.session;
  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    if (!session && state.tab.startsWith("admin")) state.tab = "standings";
  });
  await loadAll();
  state.loading = false;
  render();
  const channel = supabase.channel("public-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => loadAll().then(render))
    .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => loadAll().then(render))
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => loadAll().then(render))
    .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, () => loadAll().then(render))
    .subscribe();
}

init();
