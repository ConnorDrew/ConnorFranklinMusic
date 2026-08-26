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
})();
