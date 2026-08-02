import { supabase } from "./supabase-client.js";

export async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function fetchTeams() {
  const { data, error } = await supabase
    .from("teams")
    .select("*, players(*)")
    .order("group_name")
    .order("name");
  if (error) throw error;
  return data;
}

export async function addTeam(name, groupName) {
  const { error } = await supabase.from("teams").insert({ name, group_name: groupName });
  if (error) throw error;
}

export async function updateTeam(id, fields) {
  const { error } = await supabase.from("teams").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteTeam(id) {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

export async function addPlayer(teamId, name) {
  const { error } = await supabase.from("players").insert({ team_id: teamId, name });
  if (error) throw error;
}

export async function deletePlayer(id) {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMatches() {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "*, team1:team1_id(id,name,group_name), team2:team2_id(id,name,group_name), goals(id, player_id, team_id, players(id,name))"
    )
    .order("stage")
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function updateMatchSchedule(id, fields) {
  const { error } = await supabase.from("matches").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteMatch(id) {
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw error;
}

export async function saveMatchResult(matchId, score1, score2, goals) {
  const { error: updateError } = await supabase
    .from("matches")
    .update({ score1, score2, played: true })
    .eq("id", matchId);
  if (updateError) throw updateError;

  const { error: deleteError } = await supabase.from("goals").delete().eq("match_id", matchId);
  if (deleteError) throw deleteError;

  if (goals.length > 0) {
    const rows = goals.map((g) => ({ match_id: matchId, player_id: g.playerId || null, team_id: g.teamId }));
    const { error: insertError } = await supabase.from("goals").insert(rows);
    if (insertError) throw insertError;
  }
}

export async function resetMatchResult(matchId) {
  const { error: deleteError } = await supabase.from("goals").delete().eq("match_id", matchId);
  if (deleteError) throw deleteError;
  const { error: updateError } = await supabase
    .from("matches")
    .update({ score1: null, score2: null, played: false })
    .eq("id", matchId);
  if (updateError) throw updateError;
}

function roundRobinPairs(ids) {
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

export async function ensureGroupFixtures(teams, existingMatches) {
  for (const group of ["A", "B"]) {
    const groupTeams = teams.filter((t) => t.group_name === group);
    if (groupTeams.length !== 4) continue;
    const already = existingMatches.some((m) => m.stage === "group" && m.group_name === group);
    if (already) continue;
    const pairs = roundRobinPairs(groupTeams.map((t) => t.id));
    const rows = pairs.map(([a, b]) => ({ stage: "group", group_name: group, team1_id: a, team2_id: b }));
    const { error } = await supabase.from("matches").insert(rows);
    if (error) throw error;
  }
}

export async function ensureKnockoutFixtures(standingsA, standingsB, matches) {
  const groupAMatches = matches.filter((m) => m.stage === "group" && m.group_name === "A");
  const groupBMatches = matches.filter((m) => m.stage === "group" && m.group_name === "B");
  const groupAComplete = groupAMatches.length === 6 && groupAMatches.every((m) => m.played);
  const groupBComplete = groupBMatches.length === 6 && groupBMatches.every((m) => m.played);
  const semisExist = matches.some((m) => m.stage === "semi");

  if (groupAComplete && groupBComplete && !semisExist && standingsA.length === 4 && standingsB.length === 4) {
    const rows = [
      { stage: "semi", semi_slot: "semi1", team1_id: standingsA[0].team.id, team2_id: standingsB[1].team.id },
      { stage: "semi", semi_slot: "semi2", team1_id: standingsB[0].team.id, team2_id: standingsA[1].team.id },
    ];
    const { error } = await supabase.from("matches").insert(rows);
    if (error) throw error;
    return;
  }

  const semis = matches.filter((m) => m.stage === "semi");
  const semisComplete = semis.length === 2 && semis.every((m) => m.played);
  const finalsExist = matches.some((m) => m.stage === "final" || m.stage === "third_place");

  if (semisComplete && !finalsExist) {
    const semi1 = semis.find((m) => m.semi_slot === "semi1");
    const semi2 = semis.find((m) => m.semi_slot === "semi2");
    const winner = (m) => (m.score1 > m.score2 ? m.team1_id : m.team2_id);
    const loser = (m) => (m.score1 > m.score2 ? m.team2_id : m.team1_id);
    const rows = [
      { stage: "final", team1_id: winner(semi1), team2_id: winner(semi2) },
      { stage: "third_place", team1_id: loser(semi1), team2_id: loser(semi2) },
    ];
    const { error } = await supabase.from("matches").insert(rows);
    if (error) throw error;
  }
}

export function subscribeToChanges(callback) {
  const channel = supabase
    .channel("public-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "players" }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, callback)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
