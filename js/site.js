(function(){
  function setupModal(triggerId, modalId, closeId, embedSrc){
    var trigger = document.getElementById(triggerId);
    var overlay = document.getElementById(modalId);
    var closeBtn = document.getElementById(closeId);
    var embedLoaded = false;

    function openModal(){
      overlay.classList.add('open');
      document.body.classList.add('modal-open');
      overlay.querySelectorAll('iframe').forEach(function(f){
        if(f.dataset.src && f.src !== f.dataset.src) f.src = f.dataset.src;
      });
      if(!embedLoaded){
        embedLoaded = true;
        var s = document.createElement('script');
        s.src = embedSrc;
        s.async = true;
        document.body.appendChild(s);
      }
    }
    function closeModal(){
      overlay.classList.remove('open');
      document.body.classList.remove('modal-open');
      overlay.querySelectorAll('iframe').forEach(function(f){
        if(!f.dataset.src) f.dataset.src = f.src;
        f.src = 'about:blank';
      });
    }

    trigger.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e){
      if(e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
    });
  }

  setupModal('tiktokTrigger', 'tiktokModal', 'tiktokModalClose', 'https://www.tiktok.com/embed.js');
  setupModal('instagramTrigger', 'instagramModal', 'instagramModalClose', 'https://www.instagram.com/embed.js');

  // Drewframe Pulse: count this page view and taps on the booking links (see api/).
  // Nothing is stored in the browser; a view "starts a visit" when the visitor arrived
  // from outside the site, worked out from the referrer.
  function report(path, data){
    try{
      fetch(path, { method:'POST', keepalive:true, headers:{ 'content-type':'application/json' }, body:JSON.stringify(data) }).catch(function(){});
    }catch(e){ /* counting must never break the page */ }
  }
  function countView(){
    try{
      if(navigator.webdriver) return;
      var nav = performance.getEntriesByType('navigation')[0];
      var visit = !nav || nav.type === 'navigate';
      var ref = '';
      if(visit && document.referrer){
        var host = new URL(document.referrer).hostname.replace(/^www\./, '');
        if(host === location.hostname.replace(/^www\./, '')) visit = false;
        else ref = host;
      }
      report('/api/view', { page:location.pathname, visit:visit, ref:ref });
    }catch(e){}
  }
  if(document.prerendering) document.addEventListener('prerenderingchange', countView, { once:true });
  else countView();

  var tapped = {};
  document.addEventListener('click', function(e){
    var link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    var href = link ? link.getAttribute('href') : '';
    var kind = href.indexOf('https://wa.me/') === 0 ? 'whatsapp' : href.indexOf('mailto:') === 0 ? 'email' : href.indexOf('tel:') === 0 ? 'call' : null;
    if(!kind || tapped[kind]) return;
    tapped[kind] = true;
    report('/api/tap', { kind:kind, page:location.pathname });
  });
})();
