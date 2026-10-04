import { api } from '../api.js?v=studio20261003';
import { el, icon, progressBar } from '../dom.js?v=studio20261003';
import { icons, contentIcon } from '../icons.js?v=studio20261003';
import { store } from '../store.js?v=studio20261003';

const loading=()=>el('div',{class:'stack','aria-label':'Cargando el curso'},el('div',{class:'skeleton'}),el('div',{class:'skeleton'}));
const lessonLink=(lesson,label,className='btn')=>el('a',{class:className,href:`/lesson/${lesson.id}`,'data-route':''},label,icon(icons.arrowRight));

function switcher(tracks,active,onSwitch) {
  return el('div',{class:'course-switcher',role:'group','aria-label':'Elegir curso'},...tracks.map(track=>el('button',{
    class:'course-tab',type:'button','aria-pressed':String(track.slug===active),onClick:()=>onSwitch(track.slug)},
    icon(contentIcon(track.icon)),el('span',{text:track.slug==='sql'?'SQL':'Python'}),el('span',{class:'course-tab__count',text:`${track.lessons} lecciones`}))));
}

function lessonRow(lesson,recommended) {
  const completed=lesson.status==='completed';
  const state=completed?'Completada':lesson.inProgress?'En curso':'Pendiente';
  return el('li',{},el('a',{
    class:`lesson-node lesson-node--${completed?'completed':'available'}${recommended?' lesson-node--recommended':''}`,
    href:`/lesson/${lesson.id}`,'data-route':'','data-lesson-id':String(lesson.id),
    'aria-label':`Lección ${lesson.trackOrder}: ${lesson.title}. ${state}.${recommended?' Siguiente recomendada.':''}`},
    el('span',{class:'lesson-node__ring','aria-hidden':'true'},completed?icon(icons.check):String(lesson.trackOrder).padStart(2,'0')),
    el('span',{class:'lesson-node__content'},el('span',{class:'lesson-node__title',text:lesson.title}),
      el('span',{class:'lesson-node__meta',text:`${lesson.exerciseCount} ejercicios${lesson.inProgress?` · ${lesson.inProgress.answered}/${lesson.inProgress.total_count} respuestas guardadas`:''}${lesson.attempts?` · Mejor: ${lesson.bestCorrect}/${lesson.exerciseCount}`:''}`})),
    el('span',{class:'lesson-node__states'},recommended?el('span',{class:'pill pill--teal',text:'Recomendada'}):null,
      el('span',{class:completed?'pill pill--success':'lesson-node__state',text:state})),
    icon(icons.arrowRight,{class:'lesson-node__arrow'})));
}

export default async function renderLearn({host,refreshProgress}) {
  const container=el('div',{class:'learn-studio stack'});host.append(container);
  let track=store.user?.activeTrack??store.prefs.track??'sql',sequence=0;
  async function load() {
    const current=++sequence;container.replaceChildren(loading());
    try {
      const tracksResponse=await api.tracks();
      if(!tracksResponse.tracks.some(t=>t.slug===track)) track=tracksResponse.tracks[0]?.slug??'sql';
      const [course,progress]=await Promise.all([api.units(track),api.progress().catch(()=>store.progress)]);
      if(current!==sequence||!container.isConnected)return;
      store.set({course,tracks:tracksResponse.tracks,progress,activeTrack:track});
      draw(course,tracksResponse.tracks,progress);
    } catch(error) {
      if(current!==sequence)return;
      container.replaceChildren(el('div',{class:'empty'},el('h1',{text:'No se pudo cargar el curso'}),
        el('p',{class:'muted',text:error.message}),el('button',{class:'btn',type:'button',text:'Volver a intentar',onClick:load})));
    }
  }
  function switchTrack(next) {
    if(next===track)return;track=next;store.setPref('track',next);
    api.updateMe({activeTrack:next}).then(({user})=>store.set({user})).catch(()=>{});
    load();
  }
  function draw(course,tracks,progress) {
    const next=course.nextLesson,resume=course.resumeLesson,unavailable=course.progressUnavailable||progress?.progressUnavailable;
    const today=progress?.today;
    const pieces=[el('header',{class:'studio-heading'},
      el('div',{},el('p',{class:'eyebrow',text:'TU ESPACIO DE APRENDIZAJE'}),el('h1',{text:'Aprende a tu ritmo.'}),
        el('p',{class:'lede',text:'Empieza por lo esencial. O ve directo a lo que quieres dominar.'})),
      today&&!unavailable?el('div',{class:'daily-note'},icon(icons.target),el('div',{},
        el('strong',{text:today.goalMet?'Meta de hoy completada':`Meta de hoy · ${today.lessons}/${today.goal}`}),
        el('span',{class:'faint',text:'Cada pequeño paso cuenta.'}))):null),
      switcher(tracks,track,switchTrack)];
    if(unavailable) pieces.push(el('div',{class:'notice notice--warning',role:'status',text:'El progreso no está disponible ahora. Tus datos anteriores se conservan y todas las lecciones siguen abiertas. Si el guardado falla, podrás practicar sin guardar.'}));
    pieces.push(el('section',{class:'course-overview','aria-label':`Tu curso de ${course.track.title}`},
      el('div',{class:'course-overview__summary'},
        el('div',{class:`course-symbol course-symbol--${track}`,'aria-hidden':'true',text:track==='sql'?'SQL':'Py'}),
        el('div',{class:'grow'},el('p',{class:'eyebrow',text:'ELIGE TU SIGUIENTE RETO'}),el('h2',{text:track==='sql'?'SQL':'Python'}),
          el('p',{class:'muted',text:course.track.subtitle})),
        el('div',{class:'course-total'},el('strong',{text:unavailable?'—':`${course.totals.completed}/${course.totals.lessons}`}),el('span',{class:'faint',text:'lecciones completadas'}))),
      progressBar(unavailable?0:course.totals.completed,course.totals.lessons,{label:`Progreso del curso ${course.track.title}`}),
      next?el('div',{class:'next-lesson'},el('div',{class:'grow'},el('span',{class:'eyebrow',text:'SIGUIENTE RECOMENDADA'}),
        el('h3',{text:next.title}),el('p',{class:'muted',text:`Lección ${next.trackOrder} · ${next.exerciseCount} ejercicios · sigue el orden del curso`})),
        lessonLink(next,next.inProgress?'Retomar lección':'Empezar lección')):
        el('div',{class:'next-lesson'},el('div',{class:'grow'},el('h3',{text:'Todo el curso, a tu alcance.'}),el('p',{class:'muted',text:'Has completado este recorrido. Puedes volver a cualquier lección para reforzar lo aprendido.'})),
          el('a',{class:'btn',href:'/practice','data-route':'',text:'Repasar'})),
      resume&&resume.id!==next?.id?el('div',{class:'resume-strip'},icon(icons.practice),el('div',{class:'grow'},el('strong',{text:`También puedes retomar: ${resume.title}`}),
        el('p',{class:'faint',text:`${resume.inProgress.answered}/${resume.inProgress.total_count} respuestas guardadas`})),lessonLink(resume,'Retomar','btn btn--quiet')):null));
    pieces.push(el('div',{class:'curriculum-heading'},el('h2',{text:'Todo el recorrido'}),el('p',{class:'muted',text:'Todas las lecciones están abiertas. Los estados muestran tu avance, no limitan el acceso.'})));
    course.units.forEach((unit,index)=>pieces.push(el('section',{class:'unit','aria-labelledby':`unit-${unit.id}`},
      el('div',{class:'unit__head'},el('span',{class:'unit__badge','aria-hidden':'true',text:String(index+1).padStart(2,'0')}),
        el('div',{class:'grow'},el('h2',{class:'unit__title',id:`unit-${unit.id}`,text:unit.title}),el('p',{class:'unit__sub',text:unit.subtitle})),
        el('span',{class:'unit__completion',text:unavailable?'':`${unit.completedLessons}/${unit.lessons.length} completadas`})),
      el('ul',{class:'path'},...unit.lessons.map(lesson=>lessonRow(lesson,lesson.id===next?.id))))));
    container.replaceChildren(...pieces);
  }
  await load();
  refreshProgress().then(progress=>{if(progress&&container.isConnected&&store.course?.track.slug===track)draw(store.course,store.tracks,progress);});
}
