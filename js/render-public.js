import { computeStandings, computeTopScorers } from "./standings.js";
import { formatDateTime, teamLabel, escapeHtml, goalsForMatch, STAGE_LABELS } from "./utils.js";

function standingsTable(rows, groupName) {
  if (rows.length === 0) {
    return `<p class="empty-hint">Ainda sem equipas no Grupo ${groupName}.</p>`;
  }
  const trs = rows
    .map(
      (r, i) => `
      <tr class="${i === 0 ? "rank-1" : i === 1 ? "rank-2" : ""}">
        <td>${escapeHtml(r.team.name)}</td>
        <td>${r.pj}</td>
        <td>${r.v}</td>
        <td>${r.e}</td>
        <td>${r.d}</td>
        <td>${r.gm}</td>
        <td>${r.gs}</td>
        <td>${r.gd}</td>
        <td><strong>${r.pts}</strong></td>
      </tr>`
    )
    .join("");
  return `
    <table>
      <thead>
        <tr><th>Equipa</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>DG</th><th>Pts</th></tr>
      </thead>
      <tbody>${trs}</tbody>
    </table>`;
}

export function renderStandings(teams, matches) {
  const standingsA = computeStandings(teams, matches, "A");
  const standingsB = computeStandings(teams, matches, "B");
  return `
    <div class="card">
      <h2>Classificação</h2>
      <div class="groups-grid">
        <div>
          <h3>Grupo A</h3>
          ${standingsTable(standingsA, "A")}
        </div>
        <div>
          <h3>Grupo B</h3>
          ${standingsTable(standingsB, "B")}
        </div>
      </div>
      <p class="empty-hint" style="margin-top:10px;">O 1º de cada grupo defronta o 2º do grupo adversário nas meias-finais.</p>
    </div>`;
}

function matchRow(m) {
  const scoreHtml = m.played
    ? `<span class="score-badge">${m.score1} - ${m.score2}</span>`
    : `<span class="score-badge">vs</span>`;
  const scorers = goalsForMatch(m);
  const scorersLine = scorers.length
    ? `<div class="scorers-line">⚽ ${scorers.map(escapeHtml).join(", ")}</div>`
    : "";
  return `
    <div class="match-row">
      <div class="match-teams">
        <span class="team">${teamLabel(m.team1)}</span>
        ${scoreHtml}
        <span class="team right">${teamLabel(m.team2)}</span>
      </div>
      <div class="match-meta">${formatDateTime(m.scheduled_at)}${m.venue ? " · " + escapeHtml(m.venue) : ""}</div>
      ${scorersLine}
    </div>`;
}

export function renderCalendar(matches) {
  const groupA = matches.filter((m) => m.stage === "group" && m.group_name === "A");
  const groupB = matches.filter((m) => m.stage === "group" && m.group_name === "B");
  const knockout = matches.filter((m) => m.stage !== "group");

  const section = (title, list) =>
    list.length
      ? `<div class="card"><h2>${title}</h2>${list.map(matchRow).join("")}</div>`
      : "";

  return `
    ${groupA.length ? `<div class="card"><h2>Grupo A — Calendário</h2>${groupA.map(matchRow).join("")}</div>` : `<div class="card"><h2>Grupo A — Calendário</h2><p class="empty-hint">Calendário gerado assim que o grupo tiver 4 equipas.</p></div>`}
    ${groupB.length ? `<div class="card"><h2>Grupo B — Calendário</h2>${groupB.map(matchRow).join("")}</div>` : `<div class="card"><h2>Grupo B — Calendário</h2><p class="empty-hint">Calendário gerado assim que o grupo tiver 4 equipas.</p></div>`}
    ${section("Fase Final", knockout)}
  `;
}

export function renderBracket(matches) {
  const semi1 = matches.find((m) => m.stage === "semi" && m.semi_slot === "semi1");
  const semi2 = matches.find((m) => m.stage === "semi" && m.semi_slot === "semi2");
  const final = matches.find((m) => m.stage === "final");
  const third = matches.find((m) => m.stage === "third_place");

  const box = (m, label) =>
    m
      ? `<div class="card">${matchRow(m)}</div>`
      : `<div class="card"><p class="empty-hint">${label}</p></div>`;

  return `
    <div class="card">
      <h2>Fase Final</h2>
      <div class="bracket">
        <div class="bracket-round">
          <h3>Meias-Finais</h3>
          <div class="bracket-matches two-col">
            ${box(semi1, "1º Grupo A vs 2º Grupo B — a definir no final da fase de grupos")}
            ${box(semi2, "1º Grupo B vs 2º Grupo A — a definir no final da fase de grupos")}
          </div>
        </div>
        <div class="bracket-round">
          <h3>3º Lugar &amp; Final</h3>
          <div class="bracket-matches two-col">
            ${box(third, "Vencidos das meias-finais — a definir")}
            ${box(final, "Vencedores das meias-finais — a definir")}
          </div>
        </div>
      </div>
    </div>`;
}

export function renderScorers(matches) {
  const scorers = computeTopScorers(matches);
  if (scorers.length === 0) {
    return `<div class="card"><h2>Melhores Marcadores</h2><p class="empty-hint">Ainda não há golos registados.</p></div>`;
  }
  const trs = scorers
    .map(
      (s, i) => `
      <tr>
        <td class="rank">${i + 1}º</td>
        <td>${escapeHtml(s.player.name)}</td>
        <td><strong>${s.goals}</strong></td>
      </tr>`
    )
    .join("");
  return `
    <div class="card">
      <h2>Melhores Marcadores</h2>
      <table class="scorers-table">
        <thead><tr><th></th><th>Jogador</th><th>Golos</th></tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>`;
}
