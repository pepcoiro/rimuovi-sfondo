(() => {
  const $ = id => document.getElementById(id);
  const fileInput=$('fileInput'), chooseBtn=$('chooseBtn'), replaceBtn=$('replaceBtn');
  const placeholder=$('placeholder'), canvasWrap=$('canvasWrap'), canvas=$('resultCanvas');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const colorPicker=$('colorPicker'), tolerance=$('tolerance'), softness=$('softness');
  const allSimilar=$('allSimilar'), status=$('status');
  let originalCanvas=null, originalCtx=null, originalImageData=null, loadedName='logo', sampleMode=false, busy=false;

  function setStatus(s){status.textContent=s}
  function hexToRgb(hex){return {r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)}}
  function dist(a,b){const dr=a.r-b.r,dg=a.g-b.g,db=a.b-b.b;return Math.sqrt(dr*dr+dg*dg+db*db)}
  function pixel(data,i){return {r:data[i],g:data[i+1],b:data[i+2]}}
  function updateControls(on){
    $('sampleBtn').disabled=!on; $('edgeBtn').disabled=!on;
    $('downloadBtn').disabled=!on; $('resetBtn').disabled=!on;
    replaceBtn.hidden=!on;
  }
  function loadFile(file){
    if(!file) return;
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)){setStatus('Formato non supportato. Usa JPG, PNG o WebP.');return}
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const maxPixels=24000000, scale=Math.min(1,Math.sqrt(maxPixels/(img.naturalWidth*img.naturalHeight)));
      const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
      originalCanvas=document.createElement('canvas');originalCanvas.width=w;originalCanvas.height=h;
      originalCtx=originalCanvas.getContext('2d',{willReadFrequently:true});originalCtx.drawImage(img,0,0,w,h);
      originalImageData=originalCtx.getImageData(0,0,w,h);canvas.width=w;canvas.height=h;
      loadedName=(file.name||'logo').replace(/\.[^.]+$/,'');
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
    const d=originalImageData.data,w=originalCanvas.width,h=originalCanvas.height;
    // Median RGB of samples along the outer edge, robust against a few logo pixels touching it.
    const samples=[];
    const stride=Math.max(1,Math.floor(Math.max(w,h)/500));
    for(let x=0;x<w;x+=stride){samples.push(pixel(d,(x)*4),pixel(d,((h-1)*w+x)*4))}
    for(let y=0;y<h;y+=stride){samples.push(pixel(d,(y*w)*4),pixel(d,(y*w+w-1)*4))}
    const median=key=>{const a=samples.map(p=>p[key]).sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
    const rgb={r:median('r'),g:median('g'),b:median('b')};
    colorPicker.value='#'+[rgb.r,rgb.g,rgb.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
    if(setStatusToo)setStatus('Colore stimato dai bordi. Regola la tolleranza se necessario.');
  }
  function process(){
    if(!originalImageData||busy)return;
    busy=true;
    try{
      const w=originalCanvas.width,h=originalCanvas.height,src=originalImageData.data;
      const out=new ImageData(new Uint8ClampedArray(src),w,h);
      const key=hexToRgb(colorPicker.value), tol=Number(tolerance.value), soft=Number(softness.value);
      const total=w*h, mask=new Uint8Array(total), queue=new Int32Array(total);
      let head=0,tail=0;
      const canRemove=i=>dist(pixel(src,i*4),key)<=Math.min(442,tol+soft);
      const push=i=>{if(i<0||i>=total||mask[i]||!canRemove(i))return;mask[i]=1;queue[tail++]=i};
      if(allSimilar.checked){
        for(let i=0;i<total;i++)if(canRemove(i))mask[i]=1;
      }else{
        // Region-growing only from the outermost pixels, preserving same-color details enclosed in the logo.
        for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}
        for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
        while(head<tail){
          const i=queue[head++],x=i%w;
          if(x>0)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<total-w)push(i+w);
        }
      }
      // Feather the boundary using color distance: the closer a pixel is to the key color,
      // the more transparent it becomes. Only pixels connected to the background are altered.
      for(let i=0;i<total;i++){
        if(!mask[i])continue;
        const p=i*4,delta=dist(pixel(src,p),key);
        let alpha=0;
        if(soft>0){
          const start=Math.max(0,tol-soft),end=tol+soft;
          alpha=Math.round(255*Math.max(0,Math.min(1,(delta-start)/(end-start||1))));
        }
        out.data[p+3]=Math.min(out.data[p+3],alpha);
      }
      ctx.putImageData(out,0,0);
      setStatus(`Sfondo rimosso · ${w.toLocaleString('it-IT')} × ${h.toLocaleString('it-IT')} px`);
    }catch(e){console.error(e);setStatus("Errore durante l'elaborazione. Prova con un'immagine più piccola.")}
    busy=false;
  }
  function reset(){if(!originalImageData)return;ctx.putImageData(originalImageData,0,0);setStatus('Originale ripristinato.')}
  chooseBtn.addEventListener('click',()=>fileInput.click());
  replaceBtn.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',e=>{loadFile(e.target.files[0]);fileInput.value=''});
  ['dragenter','dragover'].forEach(ev=>$('dropZone').addEventListener(ev,e=>{e.preventDefault();$('dropZone').style.outline='2px solid #888'}));
  ['dragleave','drop'].forEach(ev=>$('dropZone').addEventListener(ev,e=>{e.preventDefault();$('dropZone').style.outline='none'}));
  $('dropZone').addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
  $('sampleBtn').addEventListener('click',()=>{sampleMode=true;canvas.style.cursor='crosshair';setStatus('Clicca sul colore dello sfondo nell’anteprima.');});
  canvas.addEventListener('click',e=>{
    if(!sampleMode||!originalImageData)return;
    const r=canvas.getBoundingClientRect(),x=Math.max(0,Math.min(canvas.width-1,Math.floor((e.clientX-r.left)/r.width*canvas.width))),y=Math.max(0,Math.min(canvas.height-1,Math.floor((e.clientY-r.top)/r.height*canvas.height)));
    const p=originalCtx.getImageData(x,y,1,1).data;
    colorPicker.value='#'+[p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    sampleMode=false;canvas.style.cursor='default';process();
  });
  $('edgeBtn').addEventListener('click',()=>{detectEdgeColor();process()});
  colorPicker.addEventListener('input',process);
  tolerance.addEventListener('input',()=>{$('toleranceValue').textContent=tolerance.value;process()});
  softness.addEventListener('input',()=>{$('softnessValue').textContent=softness.value;process()});
  allSimilar.addEventListener('change',process);
  $('resetBtn').addEventListener('click',reset);
  $('downloadBtn').addEventListener('click',()=>{
    if(!originalImageData)return;
    canvas.toBlob(blob=>{
      if(!blob){setStatus('Esportazione non riuscita.');return}
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=loadedName+'-trasparente.png';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
      setStatus('PNG trasparente esportato.');
    },'image/png');
  });
})();
