export function computeStandings(teams, matches, groupName) {
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

export function computeTopScorers(matches) {
  const counts = {};
  for (const m of matches) {
    for (const g of m.goals || []) {
      if (!g.player_id || !g.players) continue;
      if (!counts[g.player_id]) {
        counts[g.player_id] = { player: g.players, teamId: g.team_id, goals: 0 };
      }
      counts[g.player_id].goals++;
    }
  }
  return Object.values(counts).sort((a, b) => b.goals - a.goals || a.player.name.localeCompare(b.player.name));
}
