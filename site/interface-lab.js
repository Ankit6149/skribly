(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  $$('[data-view-button]').forEach(btn=>btn.addEventListener('click',()=>{
    const view=btn.dataset.viewButton;
    $$('[data-view-button]').forEach(b=>b.classList.toggle('active',b===btn));
    $$('.lab-view').forEach(v=>v.classList.toggle('active',v.dataset.view===view));
  }));

  const note=$('#noteMock');
  const stage=$('#editorStage');
  const header=$('#noteDragRegion');
  const writing=$('#writingLayer');
  const canvas=$('#inkCanvas');
  const ctx=canvas.getContext('2d');
  const dot=$('#collapsedDot');
  const colors=['yellow','peach','mint','sky','lavender'];
  const popovers=['#colorPopover','#attachPopover','#drawPopover','#textPopover','#sizePopover'];

  function closePopovers(except=null){
    popovers.forEach(s=>{const p=$(s);if(p!==except)p.hidden=true});
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('.anchored-control'))return;
    closePopovers();
  });
  function togglePopover(selector,button){
    const p=$(selector);const was=!p.hidden;closePopovers(p);p.hidden=was;
    if(button)button.classList.toggle('active',!p.hidden);
  }
  $('#colorButton').addEventListener('click',e=>{e.stopPropagation();togglePopover('#colorPopover')});
  $('#attachButton').addEventListener('click',e=>{e.stopPropagation();togglePopover('#attachPopover',$('#attachButton'))});
  $('#drawButton').addEventListener('click',e=>{
    e.stopPropagation();
    const opening=$('#drawPopover').hidden;
    togglePopover('#drawPopover',$('#drawButton'));
    note.classList.toggle('drawing',opening);
    resizeCanvas();
  });
  $('#textButton').addEventListener('click',e=>{e.stopPropagation();togglePopover('#textPopover',$('#textButton'))});
  $('#sizeButton').addEventListener('click',e=>{e.stopPropagation();togglePopover('#sizePopover',$('#sizeButton'))});

  $$('[data-note-color]').forEach(btn=>btn.addEventListener('click',()=>{
    const color=btn.dataset.noteColor;
    colors.forEach(c=>{note.classList.remove(`skrib-color-${c}`);dot.classList.remove(`skrib-color-${c}`)});
    note.classList.add(`skrib-color-${color}`);dot.classList.add(`skrib-color-${color}`);
    $('#colorButton').className=`color-button skrib-color-${color}`;
    $$('[data-note-color]').forEach(b=>b.classList.toggle('active',b===btn));
    $('#colorPopover').hidden=true;
  }));

  let fileCount=0;
  const fileIcons={Image:'ph-image',Video:'ph-video-camera',Document:'ph-file-text'};
  $$('[data-add-file]').forEach(btn=>btn.addEventListener('click',()=>{
    fileCount++;
    const type=btn.dataset.addFile;
    const ext=type==='Image'?'png':type==='Video'?'mp4':'pdf';
    const chip=document.createElement('span');
    chip.className='file-chip';
    chip.innerHTML=`<i class="ph ${fileIcons[type]}"></i>${type.toLowerCase()}-${fileCount}.${ext}`;
    $('#fileChips').append(chip);
    $('#attachPopover').hidden=true;$('#attachButton').classList.remove('active');
  }));

  $$('[data-text-size]').forEach(btn=>btn.addEventListener('click',()=>{
    const value=btn.dataset.textSize;
    writing.dataset.size=value;
    $$('[data-text-size]').forEach(b=>b.classList.toggle('active',b===btn));
    $('#textPopover').hidden=true;$('#textButton').classList.remove('active');
  }));

  const sizes={compact:[420,380],medium:[520,470],large:[640,550]};
  $$('[data-note-size]').forEach(btn=>btn.addEventListener('click',()=>{
    const value=btn.dataset.noteSize;
    const [w,h]=sizes[value];
    note.style.width=`${w}px`;note.style.height=`${h}px`;
    $$('[data-note-size]').forEach(b=>b.classList.toggle('active',b===btn));
    $('#sizePopover').hidden=true;$('#sizeButton').classList.remove('active');
    requestAnimationFrame(resizeCanvas);
  }));

  // The whole top bar is the drag surface. Controls opt out.
  header.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('[data-no-drag],button,.anchored-control'))return;
    e.preventDefault();
    const stageRect=stage.getBoundingClientRect();
    const rect=note.getBoundingClientRect();
    const startX=e.clientX,startY=e.clientY;
    const startLeft=rect.left-stageRect.left,startTop=rect.top-stageRect.top;
    note.style.left=`${startLeft}px`;note.style.top=`${startTop}px`;note.style.transform='none';
    header.classList.add('dragging');
    header.setPointerCapture(e.pointerId);
    const move=ev=>{
      const maxX=stageRect.width-note.offsetWidth-10;
      const maxY=stageRect.height-note.offsetHeight-10;
      const x=Math.max(10,Math.min(maxX,startLeft+ev.clientX-startX));
      const y=Math.max(10,Math.min(maxY,startTop+ev.clientY-startY));
      note.style.left=`${Math.round(x)}px`;note.style.top=`${Math.round(y)}px`;
    };
    const end=ev=>{
      if(header.hasPointerCapture(ev.pointerId))header.releasePointerCapture(ev.pointerId);
      header.classList.remove('dragging');
      header.removeEventListener('pointermove',move);
      header.removeEventListener('pointerup',end);
      header.removeEventListener('pointercancel',end);
    };
    header.addEventListener('pointermove',move);
    header.addEventListener('pointerup',end);
    header.addEventListener('pointercancel',end);
  });

  function collapse(){
    closePopovers();
    note.style.opacity='0';note.style.transform=note.style.transform==='none'?'scale(.98)':'translateX(-50%) scale(.98)';
    setTimeout(()=>{note.hidden=true;dot.hidden=false;note.style.opacity='1';},140);
  }
  $('#doneButton').addEventListener('click',collapse);
  $('#headerCollapse').addEventListener('click',collapse);
  dot.addEventListener('click',()=>{
    dot.hidden=true;note.hidden=false;
    note.style.transform=note.style.left.includes('px')?'none':'translateX(-50%)';
  });
  $('#repositionButton').addEventListener('click',()=>{
    note.style.left='50%';note.style.top='80px';note.style.transform='translateX(-50%)';
  });

  let drawing=false,last=null,mode='pen',ink='#262923';
  function resizeCanvas(){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const ratio=window.devicePixelRatio||1;
    const old=document.createElement('canvas');old.width=canvas.width;old.height=canvas.height;
    if(old.width&&old.height)old.getContext('2d').drawImage(canvas,0,0);
    canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    if(old.width&&old.height)ctx.drawImage(old,0,0,old.width,old.height,0,0,rect.width,rect.height);
  }
  function pt(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
  canvas.addEventListener('pointerdown',e=>{if(!note.classList.contains('drawing'))return;drawing=true;last=pt(e);canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{
    if(!drawing||!last)return;const p=pt(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.lineCap='round';ctx.lineJoin='round';
    ctx.globalCompositeOperation=mode==='erase'?'destination-out':'source-over';
    ctx.strokeStyle=mode==='highlight'?'rgba(248,203,65,.52)':ink;ctx.lineWidth=mode==='highlight'?12:mode==='erase'?18:3;ctx.stroke();last=p;
  });
  const stop=()=>{drawing=false;last=null};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
  $$('[data-draw-mode]').forEach(btn=>btn.addEventListener('click',()=>{mode=btn.dataset.drawMode;$$('[data-draw-mode]').forEach(b=>b.classList.toggle('active',b===btn))}));
  $$('[data-ink]').forEach(btn=>btn.addEventListener('click',()=>{ink=btn.dataset.ink;$$('[data-ink]').forEach(b=>b.classList.toggle('active',b===btn))}));
  $('#clearInk').addEventListener('click',()=>ctx.clearRect(0,0,canvas.width,canvas.height));
  new ResizeObserver(resizeCanvas).observe($('.composer-workspace'));
  resizeCanvas();

  // Reminder/calendar expands inside the current note instead of opening a toolbar row.
  let month=8,year=2026,selectedDay=8;
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  function renderCalendar(){
    $('#calendarTitle').textContent=`${monthNames[month]} ${year}`;
    const grid=$('#calendarDays');grid.innerHTML='';
    const first=new Date(year,month,1);let lead=(first.getDay()+6)%7;
    const days=new Date(year,month+1,0).getDate();
    const prevDays=new Date(year,month,0).getDate();
    for(let i=lead-1;i>=0;i--)addDay(prevDays-i,true);
    for(let d=1;d<=days;d++)addDay(d,false);
    while(grid.children.length<42)addDay(grid.children.length-lead-days+1,true);
    updateReminderSummary();
    function addDay(d,outside){
      const b=document.createElement('button');b.type='button';b.textContent=d;
      if(outside)b.classList.add('outside');
      const now=new Date();if(!outside&&year===now.getFullYear()&&month===now.getMonth()&&d===now.getDate())b.classList.add('today');
      if(!outside&&d===selectedDay)b.classList.add('selected');
      if(!outside)b.addEventListener('click',()=>{selectedDay=d;renderCalendar()});
      grid.append(b);
    }
  }
  function openReminder(){
    closePopovers();note.classList.remove('drawing');$('#drawButton').classList.remove('active');$('#drawPopover').hidden=true;
    note.classList.add('calendar-open');$('#reminderPanel').hidden=false;$('#remindButton').classList.add('active');
    if(note.style.transform==='none'){
      const maxW=stage.clientWidth-note.offsetLeft-10,maxH=stage.clientHeight-note.offsetTop-10;
      if(maxW<660)note.style.left=`${Math.max(10,stage.clientWidth-670)}px`;
      if(maxH<610)note.style.top=`${Math.max(10,stage.clientHeight-620)}px`;
    }
    renderCalendar();
  }
  function closeReminder(){
    $('#reminderPanel').hidden=true;note.classList.remove('calendar-open');$('#remindButton').classList.remove('active');
    note.style.width='520px';note.style.height='470px';requestAnimationFrame(resizeCanvas);
  }
  $('#remindButton').addEventListener('click',()=>$('#reminderPanel').hidden?openReminder():closeReminder());
  $('#closeReminder').addEventListener('click',closeReminder);
  $('#prevMonth').addEventListener('click',()=>{month--;if(month<0){month=11;year--}selectedDay=1;renderCalendar()});
  $('#nextMonth').addEventListener('click',()=>{month++;if(month>11){month=0;year++}selectedDay=1;renderCalendar()});
  $('#reminderTime').addEventListener('change',updateReminderSummary);
  $('#reminderRepeat').addEventListener('change',updateReminderSummary);
  function updateReminderSummary(){
    const date=new Date(year,month,selectedDay);
    const day=date.toLocaleDateString('en-GB',{weekday:'short'});
    const mon=date.toLocaleDateString('en-GB',{month:'short'});
    const repeat=$('#reminderRepeat').value;
    const repeatText=repeat==='none'?'':` · ${$('#reminderRepeat').selectedOptions[0].textContent}`;
    $('#reminderSummary').textContent=`${day}, ${mon} ${selectedDay} · ${$('#reminderTime').value}${repeatText}`;
  }
  $$('[data-quick-reminder]').forEach(btn=>btn.addEventListener('click',()=>{
    if(btn.dataset.quickReminder==='hour'){selectedDay=31;month=7;year=2026;$('#reminderTime').value='21:00'}
    if(btn.dataset.quickReminder==='tomorrow'){selectedDay=1;month=8;year=2026;$('#reminderTime').value='09:00'}
    if(btn.dataset.quickReminder==='week'){selectedDay=7;month=8;year=2026;$('#reminderTime').value='09:30'}
    renderCalendar();
  }));
  $('#saveReminder').addEventListener('click',()=>{
    const b=$('#saveReminder');b.innerHTML='<i class="ph ph-check-circle"></i> Reminder saved';
    setTimeout(()=>b.innerHTML='<i class="ph ph-check"></i> Set reminder',1200);
  });
  renderCalendar();

  const rail=$('#skribsRail');
  $('#edgeStack').addEventListener('click',()=>rail.classList.add('open'));
  $('#closeRail').addEventListener('click',()=>rail.classList.remove('open'));
  $$('[data-rail-scope]').forEach(btn=>btn.addEventListener('click',()=>{
    const all=btn.dataset.railScope==='all';
    $$('[data-rail-scope]').forEach(b=>b.classList.toggle('active',b===btn));
    $$('.all-scope').forEach(s=>s.hidden=!all);
  }));
  const notes={
    target:{title:'Target-close smoke test',context:'Chrome · GitHub · Ankit6149/skribly',text:'Verify target capture before closing the note workflow.',color:'yellow',app:'Chrome',location:'Ankit6149/skribly'},
    interface:{title:'Keep the current note language',context:'ChatGPT · Skribli build',text:'Improve the note that already works instead of replacing its personality.',color:'peach',app:'ChatGPT',location:'Skribli build'},
    release:{title:'Release-readiness list',context:'Chrome · GitHub · skribly issues',text:'Finish the native interaction details and validate them before opening downloads.',color:'mint',app:'Chrome',location:'skribly issues'},
    tokens:{title:'Clean visual tokens',context:'Visual Studio Code · skribly',text:'Keep spacing, type and controls consistent without flattening the paper character.',color:'sky',app:'Visual Studio Code',location:'skribly'},
    docs:{title:'Validation checklist',context:'Visual Studio Code · docs',text:'Validate the Windows note lifecycle against the real native surface.',color:'lavender',app:'Visual Studio Code',location:'docs'},
    licence:{title:'Licence documents',context:'File Explorer · Documents',text:'Keep customer-facing licence and support documents together.',color:'peach',app:'File Explorer',location:'Documents'}
  };
  function selectNote(id){
    const n=notes[id];if(!n)return;
    $$('.rail-note').forEach(b=>b.classList.toggle('active',b.dataset.note===id));
    $('#railPreviewContext').textContent=n.context;$('#railPreviewText').textContent=n.text;
    const p=$('#railPreview');colors.forEach(c=>p.classList.remove(`skrib-color-${c}`));p.classList.add(`skrib-color-${n.color}`);
  }
  $$('.rail-note').forEach(b=>b.addEventListener('click',()=>selectNote(b.dataset.note)));
  $('#railSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();$$('.rail-note').forEach(b=>b.hidden=!!q&&!b.textContent.toLowerCase().includes(q))});

  $$('[data-library-note]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.libraryNote,n=notes[id];if(!n)return;
    $$('[data-library-note]').forEach(b=>b.classList.toggle('active',b===btn));
    $('#libraryContext').textContent=n.context.toUpperCase();$('#libraryTitle').textContent=n.title;$('#libraryLocation').textContent=n.location;$('#libraryApp').textContent=n.app;$('#libraryPaper').textContent=n.text;
    const p=$('#libraryPaper');colors.forEach(c=>p.classList.remove(`skrib-color-${c}`));p.classList.add(`skrib-color-${n.color}`);
  }));

  window.addEventListener('resize',resizeCanvas);
})();