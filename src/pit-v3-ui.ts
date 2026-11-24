/** Group match setup without cloning form controls or changing saved settings. */
const form=document.getElementById('lobby') as HTMLFormElement|null;
const tabs=form?.querySelector<HTMLElement>('.setup-tabs');
if(form&&tabs){
  const items=[...tabs.querySelectorAll<HTMLElement>('[role=tab]')];
  const panels=items.map(item=>document.getElementById(item.getAttribute('aria-controls')!)!);
  function show(index:number, focus=false){
    items.forEach((item,i)=>{
      item.setAttribute('aria-selected',String(i===index));
      item.tabIndex=i===index?0:-1;
      panels[i].hidden=i!==index;
    });
    if(focus)items[index].focus();
  }
  items.forEach((item,i)=>{
    panels[i].role='tabpanel';
    panels[i].setAttribute('aria-labelledby',item.id);
    item.addEventListener('click',()=>show(i));
    item.addEventListener('keydown',event=>{
      const next: number|undefined=({ArrowLeft:(i+items.length-1)%items.length,ArrowRight:(i+1)%items.length,Home:0,End:items.length-1} as Record<string,number|undefined>)[event.key];
      if(next===undefined)return;
      event.preventDefault();show(next,true);
    });
  });
  let firstInvalid=false;
  form.addEventListener('invalid',event=>{
    if(firstInvalid)return; // one submit can synchronously report failures across several tabs
    firstInvalid=true;queueMicrotask(()=>{firstInvalid=false;});
    const target=event.target instanceof HTMLElement?event.target:null;
    const details:HTMLDetailsElement[]=[];
    for(let ancestor:HTMLElement|null=target?.parentElement??null;ancestor&&ancestor!==form;ancestor=ancestor.parentElement){
      if(ancestor instanceof HTMLDetailsElement)details.push(ancestor);
    }
    details.reverse().forEach(detail=>{detail.open=true;});
    const index=panels.findIndex(panel=>panel.contains(target));
    if(index>=0&&panels[index].hidden)show(index);
    // Leave native validation and focus intact after revealing the first invalid field.
  },true);
  tabs.hidden=false;show(0);
}

// Quick starts use the same validatable form, including saved configuration.
const participation=document.getElementById('participation') as HTMLSelectElement|null;
if(form&&participation)form.addEventListener('submit',event=>{
  const mode=(event.submitter as HTMLElement|null)?.dataset.launch;
  const next=mode==='watch'?'watch':mode==='play'?(participation.value==='play-mixed'?'play-mixed':'play'):null;
  if(next!==null&&next!==participation.value){
    participation.value=next;
  }
},true);
