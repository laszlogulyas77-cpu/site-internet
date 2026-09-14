(function(){
  const rules=[
    {match:(img)=>/Éric Arasse|Constantin Sinnesal|évolution professionnelle/i.test(img.alt||''),src:'assets/uploads/news-bienvenue-equipe.jpg'},
    {match:(img)=>/nouveau site internet|SERILEC — nouveau site/i.test(img.alt||''),src:'assets/uploads/news-nouveau-site.jpg'},
    {match:(img)=>/rentrée/i.test(img.alt||''),src:'assets/uploads/news-rentree.jpg'}
  ];
  function apply(root=document){
    root.querySelectorAll('img').forEach(img=>{
      const rule=rules.find(r=>r.match(img));
      if(rule && img.getAttribute('src')!==rule.src){
        img.setAttribute('src',rule.src);
        img.removeAttribute('srcset');
      }
    });
  }
  function start(){
    apply();
    new MutationObserver(muts=>{
      muts.forEach(m=>m.addedNodes.forEach(n=>{
        if(n.nodeType===1){
          if(n.tagName==='IMG') apply(n.parentNode||document);
          else apply(n);
        }
      }));
    }).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
