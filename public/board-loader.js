let attachProfessionalBoard;
const loadingRoot=document.getElementById('board-pro');
loadingRoot.textContent='جاري تحميل أدوات السبورة… قد يستغرق الاتصال الأول وقتًا أطول.';
loadingRoot.setAttribute('role','status');
try{({attachProfessionalBoard}=await import('/board-assets/board.js'));loadingRoot.removeAttribute('role');}
catch(error){loadingRoot.textContent='تعذر تحميل أدوات السبورة. تحقق من الاتصال ثم أعد المحاولة. ';const retry=document.createElement('button');retry.textContent='إعادة المحاولة';retry.onclick=()=>location.reload();loadingRoot.append(retry);throw error;}

export {attachProfessionalBoard};
