export const STAGE_LABELS = {
  group: "Fase de Grupos",
  semi: "Meia-Final",
  third_place: "3º Lugar",
  final: "Final",
};

export function formatDateTime(iso) {
  if (!iso) return "Data por marcar";
  const d = new Date(iso);
  return d.toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isoToLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputValueToIso(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function teamLabel(team) {
  return team ? escapeHtml(team.name) : "Por definir";
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

export function goalsForMatch(match) {
  return (match.goals || [])
    .map((g) => (g.players ? g.players.name : null))
    .filter(Boolean);
}
