// Administrative catalog only. These ordinals never reinterpret booking/registration grades.
export const SCHOOL_STAGES=Object.freeze({primary:Object.freeze({name:'الابتدائية',years:6}),middle:Object.freeze({name:'المتوسطة',years:3}),secondary:Object.freeze({name:'الثانوية',years:3})});
export const SCHOOL_TYPES=Object.freeze({unspecified:'غير محدد',government:'حكومي',private:'أهلي',other:'نوع آخر'});
export const SCHOOL_ORDINALS=Object.freeze(['','الأول','الثاني','الثالث','الرابع','الخامس','السادس']);
export const SCHOOL_LEVELS=Object.freeze(Object.entries(SCHOOL_STAGES).flatMap(([stage,{name,years}])=>Array.from({length:years},(_,i)=>Object.freeze({key:stage+':'+(i+1),stage,grade:i+1,label:name+' · '+SCHOOL_ORDINALS[i+1]}))));
export const validSchoolLevel=(stage,grade)=>Object.hasOwn(SCHOOL_STAGES,stage)&&Number.isInteger(grade)&&grade>=1&&grade<=SCHOOL_STAGES[stage].years;
export const schoolLevelLabel=(stage,grade)=>validSchoolLevel(stage,grade)?SCHOOL_STAGES[stage].name+' · '+SCHOOL_ORDINALS[grade]:'قيد دراسي غير صالح';
