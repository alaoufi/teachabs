import React,{useState} from 'react';
export function OriginalBookPage({page,teacher,disabled,onPage}){
 const [zoom,setZoom]=useState(100);
 if(!page)return null;
 return <section aria-label="وثيقة الاختبار الأصلية" dir="rtl" style={{border:'1px solid #aac9c4',padding:16,marginBottom:12,borderRadius:12,background:'#fff'}}>
 <strong>وثيقة أصلية للمشروع — ليست كتابًا رسميًا أو طبعة 1448</strong>
 <p>النص ثابت وطبقة الشرح مستقلة في السبورة أدناه؛ ليست كتابة فوق PDF.</p>
 <div className="board-controls"><button disabled={!teacher||disabled||page===1} onClick={()=>onPage('original-book-p1')}>الصفحة السابقة</button><output>الصفحة {page} من 2</output><button disabled={!teacher||disabled||page===2} onClick={()=>onPage('original-book-p2')}>الصفحة التالية</button><button disabled={zoom<=75} onClick={()=>setZoom(z=>z-25)}>تصغير الصفحة</button><output>{zoom}%</output><button disabled={zoom>=175} onClick={()=>setZoom(z=>z+25)}>تكبير الصفحة</button></div>
 <article style={{fontSize:zoom+'%',overflowWrap:'anywhere',padding:16,background:'#f5faf8'}}><h3>{page===1?'١ — نبني عددًا':'٢ — نقارن مجموعتين'}</h3>{page===1?<><p>ارسم ثلاث دوائر في طبقة الشرح ثم أضف دائرتين بلون آخر.</p><p>صف ما فعلته بكلماتك. كم دائرة ترى الآن؟</p></>:<><p>ارسم أربعة مربعات وست دوائر.</p><p>صل كل مربع بدائرة. أي مجموعة بقي فيها شكل دون مقابل؟ اشرح السبب.</p></>}</article>
 <p>تُحفظ الصفحة وشرحها ضمن مشاهد جلسة التجربة. الطالب يتبع المعلم. هذا ليس سجل إتقان أو تخزينًا دائمًا؛ صدّر السبورة. لا تصحيح أو شرح بالذكاء الاصطناعي.</p></section>;
}
