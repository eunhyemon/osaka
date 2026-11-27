(() => {
  'use strict';
  const RECEIPT_KEY='osaka_receipt_hailey_v1';
  const SHEET_KEY='osaka_receipt_hailey_sheet_url_v1';
  const BAG_KEY='osaka_shopping_bag_selected_v1';
  const DEFAULT_SHEET='https://script.google.com/macros/s/AKfycbwCMWcQ8UcxnzMUdFiNhvzxMaoEnOTJyK9XMUERqGTiY3rFDwpVK_YFEKFGZep5DI_K/exec';
  const demo=[
    {id:'clinic_4571609416784',name:'클리닉 마이넘버 카드 케이스 (의사 우사기)',price:550,qty:1,img:'https://chiikawamarket.jp/cdn/shop/files/4571609416784_1.jpg?v=1794294140&width=600'},
    {id:'clinic_4571609416753',name:'클리닉 약수첩 & 진찰권 커버 (간호사 친구들)',price:1100,qty:1,img:'https://chiikawamarket.jp/cdn/shop/files/4571609416753_1.jpg?v=1794294274&width=600'},
    {id:'clinic_4571609416357',name:'클리닉 백전백승 부적',price:990,qty:1,img:'https://chiikawamarket.jp/cdn/shop/files/4571609416357_1.jpg?v=1794361532&width=600'}
  ];
  const $=id=>document.getElementById(id);
  const bag=$('bag-zone'),scene=$('bag-scene'),productsEl=$('items');
  let products=[],rate=905,isDemo=false,selection=new Set(),dragging=null,scenePage=0;
  try{
    const stored=JSON.parse(localStorage.getItem(BAG_KEY)||'[]');
    if(Array.isArray(stored))selection=new Set(stored.map(String));
  }catch(_){}
  const formatYen=value=>'¥'+Math.round(value).toLocaleString('en-US');
  const formatWon=value=>'₩'+Math.round(value).toLocaleString('ko-KR');
  const sourceImage=value=>{
    if(typeof value!=='string')return '';
    try{
      const url=new URL(value,location.href);
      return ['https:','http:','data:'].includes(url.protocol) && (url.protocol!=='data:'||url.href.startsWith('data:image/'))?url.href:'';
    }catch(_){return ''}
  };
  const productId=(cat,item,i,j)=>String(item.id||[cat.id||cat.title||cat.name||i,item.name||j,j].join('::'));
  const itemsFromReceipt=data=>{
    if(!data||!Array.isArray(data.shopping))return [];
    const rows=[];
    data.shopping.forEach((cat,i)=>{
      (Array.isArray(cat.items)?cat.items:[]).forEach((item,j)=>{
        if(!item||!item.name)return;
        rows.push({
          id:productId(cat,item,i,j),
          name:String(item.name).replace(/의사\s*시사/g,'간호사 시사'),
          price:Number.isFinite(Number(item.price))?Math.max(0,Number(item.price)):0,
          qty:Math.max(1,Math.floor(Number(item.qty)||1)),
          img:sourceImage(item.img),
          category:String(cat.title||cat.name||'SHOPPING')
        });
      });
    });
    return rows;
  };
  const saveSelection=()=>{
    try{localStorage.setItem(BAG_KEY,JSON.stringify([...selection]))}catch(_){}
  };
  const selectedProducts=()=>products.filter(p=>selection.has(p.id));
  const status=message=>{$('status').textContent=message};
  const imageEl=(product,className)=>{
    if(!product.img){
      const node=document.createElement('span');node.className=className||'no-photo';node.textContent='✳';return node;
    }
    const image=document.createElement('img');
    image.src=product.img;image.alt='';image.loading='lazy';image.draggable=false;
    image.onerror=()=>{
      image.replaceWith(imageEl({...product,img:''},'no-photo'));
    };
    return image;
  };
  const add=id=>{
    if(selection.has(id))return;
    selection.add(id);saveSelection();render();
    bag.classList.remove('has-added');void bag.offsetWidth;bag.classList.add('has-added');
  };
  const remove=id=>{selection.delete(id);saveSelection();render()};
  const toggle=id=>{if(selection.has(id))remove(id);else add(id)};
  const renderBag=()=>{
    const list=selectedProducts(),fill=$('bag-fill'),pills=$('bag-items');
    fill.replaceChildren();pills.replaceChildren();
    list.slice(-16).forEach((p,i,arr)=>{
      const el=document.createElement('div');el.className='bag-object';
      const positions=[
        [27,68,-15],[68,64,18],[49,42,-11],[28,35,9],[73,35,-6],
        [45,77,21],[60,22,-13],[21,54,12],[77,75,-18]
      ];
      const [x,y,r]=positions[i%positions.length];
      el.style.left=x+'%';el.style.top=y+'%';el.style.setProperty('--rot',r+'deg');
      el.style.zIndex=String(i+1);
      el.appendChild(imageEl(p,'bag-fallback'));fill.appendChild(el);
    });
    list.forEach(p=>{
      const pill=document.createElement('div');pill.className='bag-pill';
      const name=document.createElement('span');name.textContent=p.name;
      const removeBtn=document.createElement('button');removeBtn.type='button';
      removeBtn.textContent='×';removeBtn.setAttribute('aria-label',p.name+' 쇼핑백에서 빼기');
      removeBtn.addEventListener('click',()=>remove(p.id));
      pill.append(name,removeBtn);pills.appendChild(pill);
    });
    const quantity=list.reduce((sum,p)=>sum+p.qty,0);
    const total=list.reduce((sum,p)=>sum+p.price*p.qty,0);
    $('bag-count').textContent=String(quantity).padStart(2,'0');
    $('total-yen').textContent=formatYen(total);
    $('total-won').textContent='≈ '+formatWon(total*rate/100);
    bag.classList.toggle('is-filled',list.length>0);
  };
  // Product images are physical objects around the bag, not labeled cards.
  // Show a manageable handful at a time so every item stays draggable.
  const render=()=>{
    const available=products.filter(p=>!selection.has(p.id));
    const pageSize=10;
    const pages=Math.max(1,Math.ceil(available.length/pageSize));
    scenePage=((scenePage%pages)+pages)%pages;
    const showing=available.slice(scenePage*pageSize,(scenePage+1)*pageSize);
    const fragment=document.createDocumentFragment();
    showing.forEach((p,i)=>{
      const object=document.createElement('button');
      object.type='button';
      object.className='product floating-product';
      object.dataset.id=p.id;
      object.style.setProperty('--slot',String(i));
      object.setAttribute('aria-label',p.name+' / '+formatYen(p.price)+' 쇼핑백에 담기');
      object.title=p.name+' · '+formatYen(p.price);
      const pic=document.createElement('span');pic.className='product-picture';
      pic.appendChild(imageEl(p));
      object.appendChild(pic);
      object.addEventListener('click',()=>add(p.id));
      enableDrag(object,p);
      fragment.appendChild(object);
    });
    productsEl.replaceChildren(fragment);
    $('product-count').textContent=String(available.length).padStart(2,'0')+' LEFT';
    $('shuffle-btn').textContent=pages>1?'MORE OBJECTS ↗':'SHUFFLE ↗';
    renderBag();
    $('empty-btn').disabled=!selectedProducts().length;
    $('empty-btn').style.opacity=selectedProducts().length?'1':'.35';
  };
  function enableDrag(card,p){
    card.addEventListener('pointerdown',e=>{
      if(e.button!==0||dragging)return;
      dragging={id:e.pointerId,p,startX:e.clientX,startY:e.clientY,active:false,ghost:null,card};
      try{card.setPointerCapture(e.pointerId)}catch(_){}
    });
  }
  const pointWithin=(x,y,rect)=>x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
  document.addEventListener('pointermove',e=>{
    const d=dragging;
    if(!d||e.pointerId!==d.id)return;
    const dist=Math.hypot(e.clientX-d.startX,e.clientY-d.startY);
    if(!d.active && dist>12){
      d.active=true;
      const ghost=document.createElement('div');ghost.className='drag-ghost';
      ghost.appendChild(imageEl(d.p));document.body.appendChild(ghost);d.ghost=ghost;
      d.card.classList.add('is-dragged');
    }
    if(!d.active)return;
    e.preventDefault();
    d.ghost.style.left=e.clientX+'px';d.ghost.style.top=e.clientY+'px';
    bag.classList.toggle('is-over',pointWithin(e.clientX,e.clientY,scene.getBoundingClientRect()));
  },{passive:false});
  const finish=e=>{
    const d=dragging;if(!d||d.id!==e.pointerId)return;
    if(d.active){
      d.card.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation()},{capture:true,once:true});
      const dropped=e.type==='pointerup'&&pointWithin(e.clientX,e.clientY,scene.getBoundingClientRect());
      if(dropped)add(d.p.id);
      else status('쇼핑백 위로 물건을 가져가면 담을 수 있어요.');
      d.ghost?.remove();d.card.classList.remove('is-dragged');
    }
    bag.classList.remove('is-over');
    try{d.card.releasePointerCapture(e.pointerId)}catch(_){}
    dragging=null;
  };
  document.addEventListener('pointerup',finish);
  document.addEventListener('pointercancel',finish);
  $('empty-btn').addEventListener('click',()=>{
    if(!selection.size)return;
    selection.clear();saveSelection();render();
    status('쇼핑백을 비웠어요. 다시 담아볼까요?');
  });
  $('shuffle-btn').addEventListener('click',()=>{
    const remaining=products.filter(p=>!selection.has(p.id)).length;
    if(remaining>10)scenePage=(scenePage+1)%Math.ceil(remaining/10);
    else{
      for(let i=products.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [products[i],products[j]]=[products[j],products[i]];
      }
      scenePage=0;
    }
    render();
  });
  let initialized=false;
  const apply=data=>{
    const rows=itemsFromReceipt(data);
    if(!rows.length)return false;
    products=rows;rate=Number(data.rate)||905;isDemo=false;initialized=true;
    render();status('영수증 쇼핑 목록과 연결되었어요. 담은 상태는 이 페이지에만 저장돼요.');
    return true;
  };
  const loadLocal=()=>{
    try{
      const data=JSON.parse(localStorage.getItem(RECEIPT_KEY)||'null');
      return apply(data);
    }catch(_){return false}
  };
  async function syncCloud(){
    let sheet=DEFAULT_SHEET;
    try{sheet=localStorage.getItem(SHEET_KEY)||DEFAULT_SHEET}catch(_){}
    if(!/^https:\/\//.test(sheet))return false;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(sheet+(sheet.includes('?')?'&':'?')+'t='+Date.now(),{signal:controller.signal,cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      return apply(data);
    }catch(_){return false}finally{clearTimeout(timer)}
  }
  const hasLocal=loadLocal();
  if(!hasLocal){
    products=demo.map(p=>({...p,img:sourceImage(p.img)}));isDemo=true;render();
    status('샘플 상품 3개를 표시 중이에요. 영수증 데이터를 확인하고 있어요.');
  }
  syncCloud().then(ok=>{
    if(!ok){
      if(!hasLocal)status('샘플 모드 · 영수증에서 쇼핑 항목을 등록하거나 시트 연결을 확인해 주세요.');
      else status('로컬 영수증 목록을 표시 중이에요. 시트 연결은 확인되지 않았어요.');
    }
  });
})();
