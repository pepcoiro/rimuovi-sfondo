(() => {
  const $ = id => document.getElementById(id);
  const fileInput=$('fileInput'), chooseBtn=$('chooseBtn'), replaceBtn=$('replaceBtn');
  const placeholder=$('placeholder'), dropZone=$('dropZone'), canvasWrap=$('canvasWrap'), canvas=$('resultCanvas');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const colorPicker=$('colorPicker'), tolerance=$('tolerance'), softness=$('softness');
  const allSimilar=$('allSimilar'), status=$('status');
  let originalCanvas=null, originalCtx=null, originalImageData=null, loadedName='logo', sampleMode=false, busy=false, restored=true;

  function setStatus(message){status.textContent=message}
  function hexToRgb(hex){return {r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)}}
  function distanceSquared(data,offset,r,g,b){
    const dr=data[offset]-r,dg=data[offset+1]-g,db=data[offset+2]-b;
    return dr*dr+dg*dg+db*db;
  }
  function updateControls(on){
    $('sampleBtn').disabled=!on; $('edgeBtn').disabled=!on;
    $('downloadBtn').disabled=!on; $('resetBtn').disabled=!on;
    replaceBtn.hidden=!on;
  }
  function loadFile(file){
    if(!file)return;
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)){setStatus('Formato non supportato. Usa JPG, PNG o WebP.');return}
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const maxPixels=24000000,scale=Math.min(1,Math.sqrt(maxPixels/(img.naturalWidth*img.naturalHeight)));
      const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
      originalCanvas=document.createElement('canvas');originalCanvas.width=w;originalCanvas.height=h;
      originalCtx=originalCanvas.getContext('2d',{willReadFrequently:true});originalCtx.drawImage(img,0,0,w,h);
      originalImageData=originalCtx.getImageData(0,0,w,h);canvas.width=w;canvas.height=h;
      loadedName=(file.name||'logo').replace(/\.[^.]+$/,'');restored=true;sampleMode=false;canvas.style.cursor='default';
      $('imageInfo').textContent=`${img.naturalWidth} × ${img.naturalHeight}px`;
      placeholder.style.display='none';canvasWrap.style.display='flex';canvas.style.display='block';
      updateControls(true);setStatus('Immagine caricata. Seleziona il colore da eliminare.');
      detectEdgeColor(false);process();
    };
    img.onerror=()=>{URL.revokeObjectURL(url);setStatus('Non riesco a leggere questa immagine.')};
    img.src=url;
  }
  function detectEdgeColor(setStatusToo=true){
    if(!originalImageData)return;
    const d=originalImageData.data,w=originalCanvas.width,h=originalCanvas.height,samples=[];
    const stride=Math.max(1,Math.floor(Math.max(w,h)/500));
    const addSample=i=>{const p=i*4;if(d[p+3]>16)samples.push([d[p],d[p+1],d[p+2]])};
    for(let x=0;x<w;x+=stride){addSample(x);addSample((h-1)*w+x)}
    for(let y=0;y<h;y+=stride){addSample(y*w);addSample(y*w+w-1)}
    if(!samples.length){if(setStatusToo)setStatus('Non trovo pixel opachi utili lungo i bordi.');return}
    const median=channel=>{const values=samples.map(p=>p[channel]).sort((a,b)=>a-b);return values[Math.floor(values.length/2)]};
    const rgb=[median(0),median(1),median(2)];
    colorPicker.value='#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
    if(setStatusToo)setStatus('Colore stimato dai bordi. Regola la tolleranza se necessario.');
  }
  function process(){
    if(!originalImageData||busy)return;
    busy=true;
    try{
      const w=originalCanvas.width,h=originalCanvas.height,src=originalImageData.data;
      const out=new ImageData(new Uint8ClampedArray(src),w,h);
      const key=hexToRgb(colorPicker.value),tol=Number(tolerance.value),soft=Number(softness.value);
      const keyR=key.r,keyG=key.g,keyB=key.b,limit=Math.min(442,tol+soft),limitSquared=limit*limit;
      const total=w*h,mask=new Uint8Array(total),queue=new Int32Array(total);
      const canRemove=i=>distanceSquared(src,i*4,keyR,keyG,keyB)<=limitSquared;
      const push=i=>{if(i<0||i>=total||mask[i]||!canRemove(i))return;mask[i]=1;queue[tail++]=i};
      let head=0,tail=0;
      if(allSimilar.checked){
        for(let i=0;i<total;i++)if(canRemove(i))mask[i]=1;
      }else{
        for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}
        for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
        while(head<tail){
          const i=queue[head++],x=i%w;
          if(x>0)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<total-w)push(i+w);
        }
      }
      const start=Math.max(0,tol-soft),end=tol+soft,range=end-start||1;
      for(let i=0;i<total;i++){
        if(!mask[i])continue;
        const p=i*4,delta=Math.sqrt(distanceSquared(src,p,keyR,keyG,keyB));
        let alpha=0;
        if(soft>0)alpha=Math.round(255*Math.max(0,Math.min(1,(delta-start)/range)));
        alpha=Math.min(src[p+3],alpha);
        out.data[p+3]=alpha;
        // Remove the estimated background tint from partially transparent edge pixels.
        if(alpha>0&&alpha<255){
          const a=alpha/255,inv=1-a;
          out.data[p]=Math.max(0,Math.min(255,Math.round((src[p]-inv*keyR)/a)));
          out.data[p+1]=Math.max(0,Math.min(255,Math.round((src[p+1]-inv*keyG)/a)));
          out.data[p+2]=Math.max(0,Math.min(255,Math.round((src[p+2]-inv*keyB)/a)));
        }
      }
      ctx.putImageData(out,0,0);restored=false;
      setStatus(`Sfondo rimosso · ${w.toLocaleString('it-IT')} × ${h.toLocaleString('it-IT')} px`);
    }catch(e){console.error(e);setStatus("Errore durante l'elaborazione. Prova con un'immagine più piccola.")}
    busy=false;
  }
  function reset(){
    if(!originalImageData)return;
    ctx.putImageData(originalImageData,0,0);restored=true;sampleMode=false;canvas.style.cursor='default';
    setStatus('Originale ripristinato.');
  }
  function setPreview(mode){
    canvas.dataset.preview=mode;
    document.querySelectorAll('[data-preview-choice]').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.previewChoice===mode));
    });
  }
  chooseBtn.addEventListener('click',()=>fileInput.click());
  replaceBtn.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',e=>{loadFile(e.target.files[0]);fileInput.value=''});
  ['dragenter','dragover'].forEach(ev=>dropZone.addEventListener(ev,e=>{
    e.preventDefault();dropZone.classList.add('dragging');
  }));
  ['dragleave','drop'].forEach(ev=>dropZone.addEventListener(ev,e=>{
    e.preventDefault();dropZone.classList.remove('dragging');
  }));
  dropZone.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
  window.addEventListener('dragover',e=>{if(e.dataTransfer&&Array.from(e.dataTransfer.types).includes('Files'))e.preventDefault()});
  window.addEventListener('drop',e=>{if(e.dataTransfer&&Array.from(e.dataTransfer.types).includes('Files'))e.preventDefault()});
  document.addEventListener('paste',e=>{
    const items=Array.from(e.clipboardData?.items||[]);
    const imageItem=items.find(item=>item.type.startsWith('image/'));
    if(!imageItem)return;
    const file=imageItem.getAsFile();
    if(file){e.preventDefault();loadFile(file)}
  });
  $('sampleBtn').addEventListener('click',()=>{
    sampleMode=true;canvas.style.cursor='crosshair';setStatus('Clicca sul colore dello sfondo nell’anteprima.');
  });
  canvas.addEventListener('click',e=>{
    if(!sampleMode||!originalImageData)return;
    const r=canvas.getBoundingClientRect(),x=Math.max(0,Math.min(canvas.width-1,Math.floor((e.clientX-r.left)/r.width*canvas.width))),y=Math.max(0,Math.min(canvas.height-1,Math.floor((e.clientY-r.top)/r.height*canvas.height)));
    const p=originalCtx.getImageData(x,y,1,1).data;
    colorPicker.value='#'+[p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    sampleMode=false;canvas.style.cursor='default';process();
  });
  $('edgeBtn').addEventListener('click',()=>{detectEdgeColor();process()});
  document.querySelectorAll('[data-preview-choice]').forEach(button=>button.addEventListener('click',()=>setPreview(button.dataset.previewChoice)));
  colorPicker.addEventListener('input',process);
  tolerance.addEventListener('input',()=>{$('toleranceValue').textContent=tolerance.value;process()});
  softness.addEventListener('input',()=>{$('softnessValue').textContent=softness.value;process()});
  allSimilar.addEventListener('change',process);
  $('resetBtn').addEventListener('click',reset);
  $('downloadBtn').addEventListener('click',()=>{
    if(!originalImageData)return;
    canvas.toBlob(blob=>{
      if(!blob){setStatus('Esportazione non riuscita.');return}
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=loadedName+(restored?'-originale':'-trasparente')+'.png';
      document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setStatus(restored?'Immagine originale esportata.':'PNG trasparente esportato.');
    },'image/png');
  });
})();
