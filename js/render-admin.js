import { escapeHtml, isoToLocalInputValue, teamLabel, STAGE_LABELS } from "./utils.js";

export function renderLogin(errorMsg) {
  return `
    <div class="card login-box">
      <h2>Área de Administração</h2>
      <form data-action="login-form">
        <input type="email" id="login-email" placeholder="Email" required autocomplete="username" />
        <input type="password" id="login-password" placeholder="Palavra-passe" required autocomplete="current-password" />
        <button class="btn" type="submit" style="width:100%;">Entrar</button>
        ${errorMsg ? `<p class="error-msg">${escapeHtml(errorMsg)}</p>` : ""}
      </form>
    </div>`;
}

export function renderAdminTeams(teams) {
  const countA = teams.filter((t) => t.group_name === "A").length;
  const countB = teams.filter((t) => t.group_name === "B").length;

  const teamBlock = (t) => `
    <div class="admin-team-block">
      <h3>
        ${escapeHtml(t.name)} <span style="font-size:0.75rem;opacity:0.7;">Grupo ${t.group_name}</span>
        <button class="btn danger" style="padding:3px 9px;font-size:0.75rem;" data-action="delete-team" data-id="${t.id}">Remover equipa</button>
      </h3>
      <div>
        ${(t.players || [])
          .map(
            (p) => `<span class="player-chip">${escapeHtml(p.name)}<button data-action="delete-player" data-id="${p.id}" title="Remover jogador">×</button></span>`
          )
          .join("")}
      </div>
      <form class="inline-form" style="margin-top:8px;" data-action="add-player-form" data-team="${t.id}">
        <input type="text" placeholder="Nome do jogador" required />
        <button class="btn secondary" type="submit">+ Jogador</button>
      </form>
    </div>`;

  return `
    <div class="card">
      <h2>Equipas</h2>
      <form class="inline-form" data-action="add-team-form">
        <input type="text" id="new-team-name" placeholder="Nome da equipa" required />
        <select id="new-team-group">
          <option value="A" ${countA >= 4 ? "disabled" : ""}>Grupo A (${countA}/4)</option>
          <option value="B" ${countB >= 4 ? "disabled" : ""}>Grupo B (${countB}/4)</option>
        </select>
        <button class="btn" type="submit">+ Adicionar equipa</button>
      </form>
      <div class="groups-grid">
        <div>
          <h3>Grupo A (${countA}/4)</h3>
          ${teams.filter((t) => t.group_name === "A").map(teamBlock).join("") || `<p class="empty-hint">Sem equipas.</p>`}
        </div>
        <div>
          <h3>Grupo B (${countB}/4)</h3>
          ${teams.filter((t) => t.group_name === "B").map(teamBlock).join("") || `<p class="empty-hint">Sem equipas.</p>`}
        </div>
      </div>
    </div>`;
}

export function renderAdminSchedule(matches) {
  if (matches.length === 0) {
    return `<div class="card"><h2>Horários</h2><p class="empty-hint">Os jogos aparecem aqui assim que forem gerados (adicione 4 equipas a cada grupo).</p></div>`;
  }
  const row = (m) => `
    <div class="match-row">
      <div class="match-teams">
        <span style="font-size:0.75rem;opacity:0.7;min-width:110px;">${STAGE_LABELS[m.stage]}${m.group_name ? " " + m.group_name : ""}</span>
        <span class="team">${teamLabel(m.team1)} vs ${teamLabel(m.team2)}</span>
      </div>
      <form class="inline-form" data-action="save-schedule-form" data-match="${m.id}" style="margin:0;">
        <input type="datetime-local" name="scheduled_at" value="${isoToLocalInputValue(m.scheduled_at)}" />
        <input type="text" name="venue" placeholder="Local" value="${m.venue ? escapeHtml(m.venue) : ""}" style="width:120px;" />
        <button class="btn secondary" type="submit">Guardar</button>
      </form>
    </div>`;
  return `<div class="card"><h2>Horários dos Jogos</h2>${matches.map(row).join("")}</div>`;
}

export function goalRowHtml(match, teamId, playerId) {
  const team1Id = match.team1_id;
  const team2Id = match.team2_id;
  const teamOptions = `
    <option value="${team1Id}" ${teamId === team1Id ? "selected" : ""}>${teamLabel(match.team1)}</option>
    <option value="${team2Id}" ${teamId === team2Id ? "selected" : ""}>${teamLabel(match.team2)}</option>`;
  const players = (teamId === team1Id ? match.team1?.players : match.team2?.players) || [];
  const playerOptions = players
    .map((p) => `<option value="${p.id}" ${p.id === playerId ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
    .join("");
  return `
    <div class="goal-row">
      <select class="goal-team-select">${teamOptions}</select>
      <select class="goal-player-select">${playerOptions || '<option value="">(sem jogadores)</option>'}</select>
      <button type="button" class="btn danger" style="padding:3px 9px;" data-action="remove-goal-row">×</button>
    </div>`;
}

export function renderAdminResults(matches, teamsById) {
  const matchesWithPlayers = matches.map((m) => ({
    ...m,
    team1: m.team1 ? { ...m.team1, players: teamsById[m.team1.id]?.players || [] } : null,
    team2: m.team2 ? { ...m.team2, players: teamsById[m.team2.id]?.players || [] } : null,
  }));

  if (matchesWithPlayers.length === 0) {
    return `<div class="card"><h2>Resultados</h2><p class="empty-hint">Sem jogos gerados ainda.</p></div>`;
  }

  const block = (m) => {
    const goalRows = (m.goals || [])
      .map((g) => goalRowHtml(m, g.team_id, g.player_id))
      .join("");
    return `
      <div class="card">
        <div class="match-teams" style="margin-bottom:6px;">
          <span style="font-size:0.75rem;opacity:0.7;min-width:110px;">${STAGE_LABELS[m.stage]}${m.group_name ? " " + m.group_name : ""}</span>
          <span class="team">${teamLabel(m.team1)} vs ${teamLabel(m.team2)}</span>
          ${m.played ? '<span class="badge-live">Jogado</span>' : ""}
        </div>
        <form class="result-form" data-action="save-result-form" data-match="${m.id}">
          <div class="score-inputs">
            <span>${teamLabel(m.team1)}</span>
            <input type="number" min="0" name="score1" value="${m.score1 ?? ""}" required />
            <span>—</span>
            <input type="number" min="0" name="score2" value="${m.score2 ?? ""}" required />
            <span>${teamLabel(m.team2)}</span>
          </div>
          <div>
            <div class="goal-rows" data-match-ref="${m.id}">${goalRows}</div>
            <button type="button" class="btn secondary" style="margin-top:6px;" data-action="add-goal-row" data-match="${m.id}">+ Golo</button>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn" type="submit">Guardar resultado</button>
            ${m.played ? `<button type="button" class="btn danger" data-action="reset-result" data-id="${m.id}">Repor</button>` : ""}
          </div>
        </form>
      </div>`;
  };

  return `<h2 style="color:var(--gold-light);">Resultados</h2>${matchesWithPlayers.map(block).join("")}`;
}
