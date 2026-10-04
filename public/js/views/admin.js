import { api } from '../api.js?v=studio20261003';
import { el, progressBar } from '../dom.js?v=studio20261003';

function lastActivity(value) {
  if (!value) return 'Todavía no ha practicado';
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? 'No disponible' : new Intl.DateTimeFormat('es',{dateStyle:'medium',timeStyle:'short'}).format(date);
}
export default async function renderAdmin({host}) {
  const header=el('div',{class:'row row--between admin-header'},
    el('div',{},el('h1',{text:'Participantes'}),el('p',{class:'muted',text:'Panel privado del creador'})));
  const refresh=el('button',{class:'btn btn--ghost',type:'button',text:'Actualizar'});
  header.append(refresh);
  const status=el('p',{class:'muted',role:'status','aria-live':'polite'});
  const results=el('div',{class:'admin-list stack'}),paging=el('div',{class:'row admin-paging'});
  let page=1,generation=0;
  host.append(el('section',{class:'stack admin-panel'},header,
    el('p',{text:'Solo aparecen quienes han elegido compartir su resumen. No se muestran correos, respuestas ni borradores de código.'}),
    status,results,paging));
  async function load(next=page) {
    const token=++generation;refresh.disabled=true;status.textContent='Cargando los avances…';
    try {
      const data=await api.creatorParticipants({page:next});
      if(token!==generation||!host.isConnected) return;
      page=data.page;
      status.textContent=`${data.total} ${data.total===1?'participante comparte':'participantes comparten'} su resumen. ${data.accuracy===null?'Aún no hay respuestas.':`Aciertos globales: ${data.accuracy}% de ${data.answered} respuestas.`}`;
      results.replaceChildren(...data.participants.map(person=>el('article',{class:'card stack--tight admin-person'},
        el('div',{class:'row row--between'},el('h2',{text:person.name}),person.isYou?el('span',{class:'pill',text:'Tu perfil'}):null),
        ...person.tracks.map(track=>el('div',{class:'stack--tight'},
          el('div',{class:'row row--between'},el('strong',{text:track.title}),el('span',{text:`${track.completed}/${track.total} lecciones · ${track.percent}%`})),
          progressBar(track.completed,track.total,{label:`Avance en ${track.title}`}),
          el('p',{class:'muted',text:track.nextLesson?`Siguiente lección: ${track.nextLesson}`:'Curso completado'}))),
        el('p',{text:`${person.xp} XP · ${person.answered?`${person.correct}/${person.answered} aciertos (${person.accuracy}%)`:'Todavía no ha respondido ejercicios'}`}),
        el('p',{class:'muted',text:`Última actividad de práctica: ${lastActivity(person.lastActivityAt)}`}))));
      if(!data.participants.length) results.append(el('div',{class:'card'},el('h2',{text:'Todavía no hay participantes en esta página'}),
        el('p',{text:'Cuando alguien elija compartir su resumen, aparecerá aquí. Quienes ya usaban Habla verán el aviso la próxima vez que entren; sus avances siguen guardados.'})));
      const previous=el('button',{class:'btn btn--ghost',type:'button',disabled:page<=1,text:'Anterior',onClick:()=>load(page-1)});
      const nextButton=el('button',{class:'btn btn--ghost',type:'button',disabled:!data.hasNext,text:'Siguiente',onClick:()=>load(page+1)});
      paging.replaceChildren(previous,el('span',{text:`Página ${page}`}),nextButton);
    } catch(error) {
      if(token!==generation||!host.isConnected) return;
      status.textContent=error.message;results.replaceChildren();paging.replaceChildren();
      if(error.status===403) results.append(el('a',{class:'btn',href:'/learn','data-route':'',text:'Volver a mis cursos'}));
    } finally {if(token===generation) refresh.disabled=false;}
  }
  refresh.addEventListener('click',()=>load());
  await load();
}
