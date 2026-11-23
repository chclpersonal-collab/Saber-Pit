/** Group match setup without cloning form controls or changing saved settings. */
const form=document.getElementById('lobby');
const tabs=form?.querySelector('.setup-tabs');
if(tabs){
  const items=[...tabs.querySelectorAll('[role=tab]')];
  const panels=items.map(item=>document.getElementById(item.getAttribute('aria-controls')));
  function show(index, focus=false){
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
      const next={ArrowLeft:(i+items.length-1)%items.length,ArrowRight:(i+1)%items.length,Home:0,End:items.length-1}[event.key];
      if(next===undefined)return;
      event.preventDefault();show(next,true);
    });
  });
  form.addEventListener('invalid',event=>{
    const index=panels.findIndex(panel=>panel.contains(event.target));
    if(index>=0&&panels[index].hidden)show(index);
  },true);
  tabs.hidden=false;show(0);
}

// Quick starts use the same validatable form, including saved configuration.
const participation=document.getElementById('participation');
if(form&&participation)form.addEventListener('submit',event=>{
  const mode=event.submitter?.dataset.launch;
  const next=mode==='watch'?'watch':mode==='play'?(participation.value==='play-mixed'?'play-mixed':'play'):null;
  if(next!==null&&next!==participation.value){
    participation.value=next;
  }
},true);
