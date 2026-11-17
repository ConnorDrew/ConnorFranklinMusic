(function(){
  function setupModal(triggerId, modalId, closeId, embedSrc, onOpen){
    var trigger = document.getElementById(triggerId);
    var overlay = document.getElementById(modalId);
    var closeBtn = document.getElementById(closeId);
    var embedLoaded = !embedSrc;

    function openModal(e){
      // The booking trigger is a mailto link (for visitors without JavaScript); open the form instead.
      if(e && trigger.tagName === 'A') e.preventDefault();
      overlay.classList.add('open');
      if(onOpen) onOpen();
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

  // Booking form: sends to /api/enquiry (emailed to Connor via Resend). If that fails for any
  // reason, the visitor gets a pre-filled email or WhatsApp with what they typed instead.
  var form = document.getElementById('bookForm');
  var statusEl = document.getElementById('bookStatus');
  var doneEl = document.getElementById('bookDone');
  var openedAt = 0;
  setupModal('bookTrigger', 'bookModal', 'bookModalClose', null, function(){
    if(!openedAt) openedAt = Date.now();
    var d = form.elements.namedItem('date');
    if(d && !d.min) d.min = new Date().toISOString().slice(0, 10);
    setTimeout(function(){
      if(!form.hidden) form.elements.namedItem('name').focus({ preventScroll:true });
    }, 60);
  });

  function fallback(data){
    var lines = [
      "Hi Connor, I'd like to enquire about booking you for an event.", '',
      'Name: ' + data.name,
      data.phone ? 'Phone: ' + data.phone : '',
      'Date: ' + (data.date || ''),
      'Venue / town: ' + (data.location || ''),
      'Event type: ' + (data.type || ''),
      data.message ? '\n' + data.message : ''
    ].filter(function(l, i){ return l !== '' || i === 1; }).join('\n');
    var mail = 'mailto:connorfranklinmusic@gmail.com?subject=' + encodeURIComponent('Booking Enquiry') + '&body=' + encodeURIComponent(lines.replace(/\n/g, '\r\n'));
    var wa = 'https://wa.me/447960211335?text=' + encodeURIComponent(lines);
    statusEl.innerHTML = '';
    statusEl.appendChild(document.createTextNode("Sorry, that didn't send. Your details are ready to go by "));
    var a1 = document.createElement('a'); a1.href = mail; a1.textContent = 'email';
    var a2 = document.createElement('a'); a2.href = wa; a2.target = '_blank'; a2.rel = 'noopener'; a2.textContent = 'WhatsApp';
    statusEl.appendChild(a1);
    statusEl.appendChild(document.createTextNode(' or '));
    statusEl.appendChild(a2);
    statusEl.appendChild(document.createTextNode(' instead.'));
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(!form.reportValidity()) return;
    var val = function(n){ return form.elements.namedItem(n).value.trim(); };
    var data = {
      name: val('name'),
      email: val('email'),
      phone: val('phone'),
      date: val('date'),
      location: val('location'),
      type: val('type'),
      message: val('message'),
      website: val('website'),
      elapsed: openedAt ? Date.now() - openedAt : 0
    };
    var btn = form.querySelector('.bsubmit');
    btn.disabled = true;
    btn.firstElementChild.textContent = 'Sending…';
    statusEl.textContent = '';
    fetch('/api/enquiry', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(data) })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return { status:r.status, body:j }; }); })
      .then(function(r){
        if(r.status === 200 && r.body.ok){
          form.hidden = true;
          doneEl.hidden = false;
          doneEl.focus();
          return;
        }
        if(r.status === 400 && r.body.fields && r.body.fields.length){
          var f = form.elements.namedItem(r.body.fields[0]);
          statusEl.textContent = 'Please check the ' + (r.body.fields[0] === 'location' ? 'venue' : r.body.fields[0]) + ' field.';
          if(f) f.focus();
          return;
        }
        fallback(data);
      })
      .catch(function(){ fallback(data); })
      .then(function(){
        btn.disabled = false;
        btn.firstElementChild.textContent = 'Send enquiry';
      });
  });

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
      // ?pulse=off on any page: this browser's visits aren't counted from now on (the owner
      // checking their own site). ?pulse=on undoes it. Only then is anything stored.
      var choice = new URLSearchParams(location.search).get('pulse');
      if (choice === 'off' || choice === 'on') {
        try { if (choice === 'off') localStorage.setItem('pulse-off', '1'); else localStorage.removeItem('pulse-off'); } catch (e) {}
        alert(choice === 'off' ? 'Done. Visits from this browser will not be counted in the website stats.' : 'Visits from this browser will be counted again.');
        return;
      }
      try { if (localStorage.getItem('pulse-off')) return; } catch (e) {}
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
