import { UserError } from './store.mjs';

export const ratings={independent:'أتقنها بمفرده',help:'احتاج مساعدة',practice:'يحتاج مزيدًا من التدريب'};
export function initialPlace() {
  return {rev:0,phase:'model',target:34,tens:0,ones:0,answer:null,attempts:0,rating:'',note:''};
}
function requireValue(ok,message,status=400){if(!ok)throw new UserError(message,status);}
export function advancePlace(current,seat,change,afterLesson=false) {
  const s=current??initialPlace();
  requireValue(change && typeof change==='object','طلب نشاط غير صالح.');
  requireValue(change.rev===s.rev,'تغيّرت اللوحة. راجع الحالة الحالية ثم حاول مجددًا.',409);
  const next={...s,rev:s.rev+1};
  const teacher=()=>requireValue(seat==='teacher','هذا الإجراء للمعلم.',403);
  const phase=(value)=>requireValue(s.phase===value,'هذه الخطوة غير متاحة الآن.',409);
  switch(change.op){
    case 'target':
      teacher();phase('model');
      requireValue(Number.isInteger(change.value)&&change.value>=0&&change.value<=99,'اختر عددًا من ٠ إلى ٩٩.');
      return {...next,target:change.value,tens:0,ones:0};
    case 'turn':
      teacher();phase('model');
      if(change.value!==undefined)requireValue(Number.isInteger(change.value)&&change.value>=0&&change.value<=99,'اختر عددًا من ٠ إلى ٩٩.');
      return {...next,phase:'solving',target:change.value??s.target,tens:0,ones:0};
    case 'split':
    case 'bundle':
    case 'move': {
      requireValue((s.phase==='model'&&seat==='teacher') || (s.phase==='solving'&&seat==='student'),'التحريك متاح لصاحب الدور فقط.',403);
      if(change.op==='split'){
        requireValue(s.tens>=1,'أضف عشرة أولًا.');
        return {...next,tens:s.tens-1,ones:s.ones+10};
      }
      if(change.op==='bundle'){
        requireValue(s.ones>=10,'اجمع عشرة آحاد أولًا.');
        return {...next,tens:s.tens+1,ones:s.ones-10};
      }
      requireValue(['tens','ones'].includes(change.unit)&&[1,-1].includes(change.delta),'حركة غير صالحة.');
      const count=s[change.unit]+change.delta;
      const total=s.tens*10+s.ones+change.delta*(change.unit==='tens'?10:1);
      requireValue(count>=0 && total<=99,'يمكن تمثيل الأعداد من صفر إلى ٩٩ فقط.');
      return {...next,[change.unit]:count};
    }
    case 'submit':
      requireValue(seat==='student','التسليم من مقعد الطالب.',403);phase('solving');
      requireValue(s.ones<10,'اجمع كل عشرة آحاد في قضيب قبل تسليم الحل.');
      return {...next,phase:'submitted',answer:{tens:s.tens,ones:s.ones},attempts:s.attempts+1};
    case 'retry':
      teacher();phase('submitted');
      return {...next,phase:'solving'};
    case 'grade':
      teacher();
      requireValue(s.answer && s.phase!=='graded','يلزم حل مسلّم لم يُعتمد بعد.',409);
      if(!afterLesson)phase('submitted');
      requireValue(typeof change.rating==='string'&&Object.hasOwn(ratings,change.rating),'اختر تقييم المعلم.');
      requireValue(typeof change.note==='string'&&change.note.trim().length<=350,'حد الملاحظة ٣٥٠ حرفًا.');
      return {...next,phase:'graded',rating:change.rating,note:change.note.trim()};
    default: throw new UserError('إجراء النشاط غير معروف.');
  }
}
export function visiblePlace(state,seat) {
  if(seat==='teacher')return state;
  const {rating,note,...visible}=state;
  return visible;
}
