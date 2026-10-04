import { api } from '../api.js?v=studio20261003';
import { el } from '../dom.js?v=studio20261003';
import { store } from '../store.js?v=studio20261003';

export const PROGRESS_NOTICE_VERSION = 'creator-summary-20261003';
export const progressPrivacyText = 'El creador de Habla puede consultar tu nombre de perfil, lecciones completadas en Python y SQL, aciertos, XP y última actividad si eliges compartir tu resumen. Otros alumnos no pueden verlo. Este panel no muestra tu correo, tus respuestas ni el código que escribes.';

export default function renderPrivacy({host,navigate}) {
  const error = el('p',{class:'formerror',role:'alert',hidden:true});
  const status = el('p',{role:'status',class:'muted'});
  const share = el('button',{class:'btn btn--lg',type:'button',text:'Compartir mi resumen y continuar'});
  const privateButton = el('button',{class:'btn btn--ghost',type:'button',text:'Continuar sin compartir'});
  async function choose(progressSharing) {
    share.disabled=privateButton.disabled=true;error.hidden=true;status.textContent='Guardando tu elección…';
    try {
      const {user}=await api.updateMe({progressSharing,progressNoticeVersion:PROGRESS_NOTICE_VERSION});
      store.set({user});
      const next = store.needsOnboarding ? '/onboarding' : location.pathname==='/privacy' ? '/profile' : location.pathname;
      navigate(next,{replace:true});
    } catch(problem) {
      error.textContent=problem.message;error.hidden=false;status.textContent='';share.disabled=privateButton.disabled=false;
    }
  }
  share.addEventListener('click',()=>choose(true));privateButton.addEventListener('click',()=>choose(false));
  host.append(el('section',{class:'card privacy-card stack'},
    el('h1',{text:'Tu progreso y tu privacidad'}),el('p',{text:progressPrivacyText}),
    el('p',{text:'Puedes aprender y guardar todos tus avances sin compartir el resumen. Tu elección no afecta al curso y puedes cambiarla en Perfil.'}),
    el('p',{class:'muted',text:'Habla guarda tu perfil y progreso en la nube para que puedas continuar con la misma cuenta en otro dispositivo.'}),
    el('div',{class:'stack--tight'},share,privateButton),error,status));
}
