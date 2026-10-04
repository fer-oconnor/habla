// Proyección limitada para el creador: nunca incluye correos, respuestas ni borradores.
export const PROGRESS_NOTICE_VERSION = 'creator-summary-20261003';
export function participantSummary(row, catalog, ownerId) {
  const progress = typeof row.lesson_progress === 'string' ? JSON.parse(row.lesson_progress) : row.lesson_progress ?? {};
  const count = value => Math.max(0, Number(value) || 0);
  const answered = count(row.answered), correct = Math.min(answered,count(row.correct));
  const tracks = catalog.tracks.map(track => {
    const lessons = catalog.lessons.filter(l => l.track===track.slug).sort((a,b) => a.track_order-b.track_order);
    const completed = lessons.filter(l => progress[l.id]?.status==='completed').length;
    const next = lessons.find(l => progress[l.id]?.status!=='completed');
    return {slug:track.slug,title:track.title,completed,total:lessons.length,
      percent:lessons.length?Math.round(completed/lessons.length*100):0,nextLesson:next?.title??null};
  });
  return {name:String(row.display_name || 'Participante').slice(0,40),isYou:row.id===ownerId,
    tracks,answered,correct,accuracy:answered?Math.round(correct/answered*100):null,
    xp:count(row.xp),lastActivityAt:row.last_activity_at||null};
}
