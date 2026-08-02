import {
  login,
  logout,
  getSession,
  onAuthChange,
  fetchTeams,
  fetchMatches,
  addTeam,
  updateTeam,
  deleteTeam,
  addPlayer,
  deletePlayer,
  updateMatchSchedule,
  saveMatchResult,
  resetMatchResult,
  ensureGroupFixtures,
  ensureKnockoutFixtures,
  subscribeToChanges,
} from "./db.js";
import { computeStandings } from "./standings.js";
import { renderStandings, renderCalendar, renderBracket, renderScorers } from "./render-public.js";
import { renderLogin, renderAdminTeams, renderAdminSchedule, renderAdminResults, goalRowHtml } from "./render-admin.js";
import { localInputValueToIso, escapeHtml } from "./utils.js";

const state = {
  session: null,
  teams: [],
  matches: [],
  tab: "standings",
  loginError: null,
  loading: true,
};

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

async function loadAll() {
  const [teams, matches] = await Promise.all([fetchTeams(), fetchMatches()]);
  state.teams = teams;
  state.matches = matches;

  if (state.session) {
    try {
      await ensureGroupFixtures(state.teams, state.matches);
      let refreshed = await fetchMatches();
      const standingsA = computeStandings(state.teams, refreshed, "A");
      const standingsB = computeStandings(state.teams, refreshed, "B");
      await ensureKnockoutFixtures(standingsA, standingsB, refreshed);
      state.matches = await fetchMatches();
    } catch (err) {
      console.error("Erro ao gerar jogos automaticamente:", err);
    }
  }
}

function renderNav() {
  const tabs = state.session ? [...PUBLIC_TABS, ...ADMIN_TABS] : PUBLIC_TABS;
  const buttons = tabs
    .map(
      (t) =>
        `<button data-action="tab" data-tab="${t.id}" class="${state.tab === t.id ? "active" : ""}">${t.label}</button>`
    )
    .join("");
  const authButton = state.session
    ? `<button data-action="logout" class="secondary" style="border-color:var(--gold);">Sair</button>`
    : `<button data-action="tab" data-tab="login" class="${state.tab === "login" ? "active" : ""}">Admin</button>`;
  return `<nav class="tabs">${buttons}${authButton}</nav>`;
}

function renderContent() {
  if (state.loading) {
    return `<div class="card"><p class="empty-hint">A carregar...</p></div>`;
  }
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
      await logout();
      state.tab = "standings";
      render();
    } else if (action === "delete-team") {
      if (confirm("Remover esta equipa e todos os seus jogadores?")) {
        await deleteTeam(el.dataset.id);
        await loadAll();
        render();
      }
    } else if (action === "delete-player") {
      if (confirm("Remover este jogador?")) {
        await deletePlayer(el.dataset.id);
        await loadAll();
        render();
      }
    } else if (action === "reset-result") {
      if (confirm("Repor o resultado deste jogo? Os golos registados serão apagados.")) {
        await resetMatchResult(el.dataset.id);
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
  const players =
    (newTeamId === match.team1_id ? byId[match.team1_id]?.players : byId[match.team2_id]?.players) || [];
  const playerSelect = row.querySelector(".goal-player-select");
  playerSelect.innerHTML =
    players.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("") ||
    '<option value="">(sem jogadores)</option>';
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
        await login(email, password);
        state.session = await getSession();
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
      await addTeam(name, group);
      await loadAll();
      render();
    } else if (action === "add-player-form") {
      const teamId = form.dataset.team;
      const input = form.querySelector("input");
      const name = input.value.trim();
      if (!name) return;
      await addPlayer(teamId, name);
      await loadAll();
      render();
    } else if (action === "save-schedule-form") {
      const matchId = form.dataset.match;
      const scheduledAt = localInputValueToIso(form.scheduled_at.value);
      const venue = form.venue.value.trim();
      await updateMatchSchedule(matchId, { scheduled_at: scheduledAt, venue: venue || null });
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
      const goals = Array.from(goalRows).map((row) => ({
        teamId: row.querySelector(".goal-team-select").value,
        playerId: row.querySelector(".goal-player-select").value || null,
      }));
      await saveMatchResult(matchId, score1, score2, goals);
      await loadAll();
      render();
    }
  } catch (err) {
    alert("Erro: " + err.message);
  }
});

async function init() {
  state.session = await getSession();
  onAuthChange((session) => {
    state.session = session;
    if (!session && state.tab.startsWith("admin")) state.tab = "standings";
  });
  await loadAll();
  state.loading = false;
  render();
  subscribeToChanges(async () => {
    await loadAll();
    render();
  });
}

init();
