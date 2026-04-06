/* ═══════════════════════════════════════════════════════════
   OFAI.ro — Main JavaScript
   Scroll reveal, navbar logic, counters, interactions
   ═══════════════════════════════════════════════════════════ */

/* ─── GA4 EVENT HELPER ─────────────────────────────────── */
window.gaEvent = function(eventName, params) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params || {});
  }
};

/* ─── CSRF TOKEN HELPER ──────────────────────────────────── */
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

/* ─── LENIS SMOOTH SCROLL ────────────────────────────────── */
var lenis = null;

function initLenis() {
  if (typeof Lenis === 'undefined') return;

  lenis = new Lenis({
    duration: 1.2,
    easing: function(t) { return 1 - Math.pow(1 - t, 5); },
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    touchMultiplier: 1.5,
  });

  window.lenis = lenis;

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

document.addEventListener('DOMContentLoaded', () => {
  initLenis();
  initNavbar();
  initScrollReveal();
  initCounters();
  initMobileMenu();
  initSmoothScroll();
  initGeolocation();
  initSearchAutosuggest();
  initTiltFx();
  initParticles();
  initScrollArrows();
  initCountdowns();
});

/* ─── COUNTDOWN TIMERS ──────────────────────────────────── */
function initCountdowns() {
  function update() {
    document.querySelectorAll('[data-end-date]').forEach(function(el) {
      var endDate = new Date(el.getAttribute('data-end-date'));
      var now = new Date();
      var diff = endDate - now;

      // Expired — hide entirely (SQL filters should prevent this, but just in case)
      if (diff <= 0) {
        el.style.display = 'none';
        return;
      }

      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var mins = Math.floor((diff % 3600000) / 60000);

      // Only show countdown when 7 days or less remain
      if (days > 7) {
        el.style.display = 'none';
        return;
      }

      // Show the element (must be 'block' to override CSS display:none)
      el.style.display = 'block';

      // Build display text (short to fit small cards)
      var text;
      if (days > 0) {
        text = 'Expir\u0103 \u00een ' + days + 'z \u0219i ' + hours + 'h';
      } else if (hours > 0) {
        text = 'Expir\u0103 \u00een ' + hours + 'h \u0219i ' + mins + 'm';
      } else {
        text = 'Expir\u0103 \u00een ' + mins + 'm';
      }
      el.textContent = text;

      // Remove old urgency classes
      el.classList.remove('urgency-low', 'urgency-medium', 'urgency-high', 'urgency-critical');

      // Apply color class based on remaining time
      if (days >= 3) {
        el.classList.add('urgency-medium');
      } else if (days >= 1 || hours >= 24) {
        el.classList.add('urgency-high');
      } else {
        el.classList.add('urgency-critical');
      }
    });
  }
  update();
  setInterval(update, 60000);
}

/* ─── NAVBAR ─────────────────────────────────────────────── */
function initNavbar() {
  const wrapper = document.querySelector('.navbar-wrapper');
  if (!wrapper) return;

  let lastScroll = 0;

  function onScroll(currentScroll) {
    if (currentScroll > 20) {
      wrapper.classList.add('scrolled');
    } else {
      wrapper.classList.remove('scrolled');
    }

    if (currentScroll > 300) {
      if (currentScroll > lastScroll + 5) {
        wrapper.classList.add('hidden');
      } else if (currentScroll < lastScroll - 5) {
        wrapper.classList.remove('hidden');
      }
    } else {
      wrapper.classList.remove('hidden');
    }

    lastScroll = currentScroll;
  }

  if (window.lenis) {
    window.lenis.on('scroll', function(e) {
      onScroll(e.scroll);
    });
  } else {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          onScroll(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    });
  }
}

/* ─── SCROLL REVEAL ──────────────────────────────────────── */
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  reveals.forEach(el => observer.observe(el));
}

/* ─── ANIMATED COUNTERS ──────────────────────────────────── */
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length === 0) return;

  // Skip animation if already shown this session
  if (sessionStorage.getItem('countersAnimated')) {
    counters.forEach(el => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      const suffix = el.getAttribute('data-suffix') || '';
      const prefix = el.getAttribute('data-prefix') || '';
      el.textContent = prefix + target.toLocaleString('ro-RO') + suffix;
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

function animateCounter(el) {
  const target = parseInt(el.getAttribute('data-count'), 10);
  const suffix = el.getAttribute('data-suffix') || '';
  const prefix = el.getAttribute('data-prefix') || '';
  const duration = 1500;
  const start = Date.now();

  function update() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);

    el.textContent = prefix + current.toLocaleString('ro-RO') + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      sessionStorage.setItem('countersAnimated', '1');
    }
  }

  requestAnimationFrame(update);
}

/* ─── MOBILE MENU ────────────────────────────────────────── */
function initMobileMenu() {
  const toggle = document.querySelector('.nav-menu-toggle');
  const overlay = document.querySelector('.nav-mobile-overlay');
  if (!toggle || !overlay) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    overlay.classList.toggle('open');
    const isOpen = overlay.classList.contains('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (window.lenis) { isOpen ? window.lenis.stop() : window.lenis.start(); }
  });

  // Close on link click
  overlay.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      if (window.lenis) window.lenis.start();
    });
  });
}

/* ─── SMOOTH SCROLL ──────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        if (window.lenis) {
          window.lenis.scrollTo(target, { offset: -80 });
        } else {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

/* ─── TOAST NOTIFICATION SYSTEM ─────────────────────────── */
window.showToast = function(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.innerHTML = icons[type] || icons.info; // SVG hardcoded — safe
  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-msg';
  msgSpan.textContent = message; // textContent — XSS safe
  const progress = document.createElement('div');
  progress.className = 'toast-progress';
  progress.style.setProperty('--toast-dur', duration + 'ms');
  toast.append(iconSpan, msgSpan, progress);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
};

/* ─── FAVORITE TOGGLE ───────────────────────────────────── */
window.toggleFavorite = async function(offerId) {
  // Find ALL buttons for this offer (detail page .bookmark-btn + card .card-heart-btn)
  const allBtns = document.querySelectorAll(`.bookmark-btn[data-offer-id="${offerId}"], .card-heart-btn[data-offer-id="${offerId}"]`);
  if (!allBtns.length) return;

  const isFav = allBtns[0].dataset.favorited === 'true' || allBtns[0].classList.contains('is-active');

  try {
    if (isFav) {
      const resp = await fetch(`/api/web/favorites/${offerId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': getCsrfToken() },
      });
      if (!resp.ok) {
        const data = await resp.json();
        if (resp.status === 401) return window.location.href = '/login?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);
        throw new Error(data.message);
      }
      allBtns.forEach(btn => {
        btn.dataset.favorited = 'false';
        btn.classList.remove('is-favorited', 'is-active');
      });
      showToast('Eliminat din favorite', 'info');
      window.gaEvent('remove_from_wishlist', { item_id: offerId });
      const businessId = extractBusinessIdFromContext();
      if (businessId && window.trackClick) {
        window.trackClick(businessId, 'unfavorite', offerId);
      }
    } else {
      const resp = await fetch('/api/web/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken(),
        },
        body: JSON.stringify({ offer_id: offerId }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        if (resp.status === 401) return window.location.href = '/login?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);
        throw new Error(data.message);
      }
      allBtns.forEach(btn => {
        btn.dataset.favorited = 'true';
        btn.classList.add('is-favorited', 'is-active');
      });
      showToast('Adăugat la favorite!', 'success');
      window.gaEvent('add_to_wishlist', { item_id: offerId });
      const businessId = extractBusinessIdFromContext();
      if (businessId && window.trackClick) {
        window.trackClick(businessId, 'favorite', offerId);
      }
    }
  } catch (err) {
    showToast(err.message || 'Eroare la favorite', 'error');
  }
};

/* ─── FOLLOW / UNFOLLOW TOGGLE ──────────────────────────── */
window.toggleFollow = async function(businessId) {
  // Find ALL buttons for this business (detail page .bd-follow-btn + card .card-heart-btn)
  const detailBtn = document.querySelector(`.bd-follow-btn[data-business-id="${businessId}"]`);
  const heartBtns = document.querySelectorAll(`.card-heart-btn[data-business-id="${businessId}"]`);

  const isFollowing = detailBtn
    ? detailBtn.dataset.following === 'true'
    : (heartBtns.length ? heartBtns[0].classList.contains('is-active') : false);

  if (!detailBtn && !heartBtns.length) return;

  try {
    if (isFollowing) {
      const resp = await fetch(`/api/web/subscriptions/${businessId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': getCsrfToken() },
      });
      if (!resp.ok) {
        const data = await resp.json();
        if (resp.status === 401) return window.location.href = '/login?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);
        throw new Error(data.message);
      }
      if (detailBtn) {
        detailBtn.dataset.following = 'false';
        detailBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> Urmărește';
        detailBtn.classList.remove('following');
      }
      heartBtns.forEach(btn => btn.classList.remove('is-active'));
      showToast('Nu mai urmărești acest business', 'info');
      window.gaEvent('unfollow_business', { business_id: businessId });
      if (window.trackClick) {
        window.trackClick(businessId, 'unfollow');
      }
    } else {
      const resp = await fetch('/api/web/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken(),
        },
        body: JSON.stringify({ business_id: businessId }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        if (resp.status === 401) return window.location.href = '/login?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);
        throw new Error(data.message);
      }
      if (detailBtn) {
        detailBtn.dataset.following = 'true';
        detailBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Urmărești';
        detailBtn.classList.add('following');
      }
      heartBtns.forEach(btn => btn.classList.add('is-active'));
      showToast('Urmărești acest business!', 'success');
      window.gaEvent('follow_business', { business_id: businessId });
      if (window.trackClick) {
        window.trackClick(businessId, 'follow');
      }
    }
  } catch (err) {
    showToast(err.message || 'Eroare', 'error');
  }
};

/* ─── CARD HEART HELPERS (stop event propagation inside <a> tags) ─── */
window.toggleCardFavorite = function(offerId, event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  window.toggleFavorite(offerId);
};
window.toggleCardFollow = function(businessId, event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  window.toggleFollow(businessId);
};

/* ─── USER MENU — Close on outside click ────────────────── */
document.addEventListener('click', (e) => {
  const dropdown = document.querySelector('.user-menu-dropdown');
  const trigger = document.querySelector('.user-menu-trigger');
  if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

/* ─── FAQ ACCORDION ─────────────────────────────────────── */
document.addEventListener('click', (e) => {
  const question = e.target.closest('.faq-question');
  if (!question) return;
  const item = question.closest('.faq-item');
  if (!item) return;
  item.classList.toggle('open');
});

/* ─── STAR RATING SELECT ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.star-select').forEach(container => {
    const input = container.querySelector('input[name="rating"]');
    const stars = container.querySelectorAll('.star-select-btn');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.value);
        if (input) input.value = val;
        stars.forEach(s => {
          s.classList.toggle('active', parseInt(s.dataset.value) <= val);
        });
      });
    });
  });
});

/* ─── GEOLOCATION + DISTANCE ───────────────────────────── */
function initGeolocation() {
  const cards = document.querySelectorAll('.offer-distance[data-lat][data-lng]');
  if (cards.length === 0) return;

  const banner = document.getElementById('geo-banner');
  const bannerText = document.getElementById('geo-banner-text');
  const activateBtn = document.getElementById('geo-activate-btn');

  // Check sessionStorage cache first for instant display
  const cached = sessionStorage.getItem('ofai_user_pos');
  if (cached) {
    try {
      const pos = JSON.parse(cached);
      updateDistances(pos.lat, pos.lng, cards);
      enableDistanceSortBtn();
      if (banner) {
        banner.style.display = '';
        banner.classList.add('geo-active');
        if (bannerText) bannerText.textContent = 'Locație activă — distanțele sunt afișate';
        if (activateBtn) activateBtn.style.display = 'none';
      }
    } catch(e) {}
    return;
  }

  // No cached position — show activation banner if geolocation is available
  if (!navigator.geolocation) return;
  if (banner) banner.style.display = '';

  if (activateBtn) {
    activateBtn.addEventListener('click', () => {
      activateBtn.textContent = 'Se caută...';
      activateBtn.disabled = true;

      navigator.geolocation.getCurrentPosition((pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        sessionStorage.setItem('ofai_user_pos', JSON.stringify({ lat: userLat, lng: userLng }));
        updateDistances(userLat, userLng, cards);
        enableDistanceSortBtn();

        if (banner) {
          banner.classList.add('geo-active');
          if (bannerText) bannerText.textContent = 'Locație activă — distanțele sunt afișate';
          activateBtn.style.display = 'none';
        }
      }, () => {
        if (bannerText) bannerText.textContent = 'Nu am putut accesa locația. Verifică setările browserului.';
        activateBtn.textContent = 'Reîncearcă';
        activateBtn.disabled = false;
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    });
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function formatDistance(km) {
  if (km < 1) return Math.round(km * 1000) + ' m';
  return km.toFixed(1) + ' km';
}

function updateDistances(userLat, userLng, cards) {
  cards.forEach((el) => {
    const lat = parseFloat(el.dataset.lat);
    const lng = parseFloat(el.dataset.lng);
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;
    const km = haversineKm(userLat, userLng, lat, lng);
    const text = el.querySelector('.offer-distance-text');
    if (text) {
      text.textContent = formatDistance(km);
      el.style.display = '';
    }
  });
}

/* ─── SORT BY DISTANCE ─────────────────────────────────── */
window.sortByDistance = function() {
  const grid = document.querySelector('.offers-grid');
  if (!grid) return;

  const cached = sessionStorage.getItem('ofai_user_pos');
  if (!cached) {
    // No position — trigger geolocation first
    const activateBtn = document.getElementById('geo-activate-btn');
    if (activateBtn) activateBtn.click();
    // After activation, retry sort
    const checkInterval = setInterval(() => {
      if (sessionStorage.getItem('ofai_user_pos')) {
        clearInterval(checkInterval);
        window.sortByDistance();
      }
    }, 500);
    setTimeout(() => clearInterval(checkInterval), 15000);
    return;
  }

  const pos = JSON.parse(cached);
  const cards = Array.from(grid.querySelectorAll('.offer-card'));

  // Calculate distance for each card
  cards.forEach(card => {
    const distEl = card.querySelector('.offer-distance[data-lat][data-lng]');
    if (!distEl) { card._dist = 99999; return; }
    const lat = parseFloat(distEl.dataset.lat);
    const lng = parseFloat(distEl.dataset.lng);
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) { card._dist = 99999; return; }
    card._dist = haversineKm(pos.lat, pos.lng, lat, lng);
  });

  // Sort by distance ascending
  cards.sort((a, b) => a._dist - b._dist);

  // Re-append sorted
  cards.forEach(card => grid.appendChild(card));

  // Update active pill state
  document.querySelectorAll('.sort-bar .filter-pill').forEach(p => p.classList.remove('active'));
  const distBtn = document.getElementById('sort-distance-btn');
  if (distBtn) distBtn.classList.add('active');

  // Ensure distances are visible
  updateDistances(pos.lat, pos.lng, document.querySelectorAll('.offer-distance[data-lat][data-lng]'));
};

function enableDistanceSortBtn() {
  const btn = document.getElementById('sort-distance-btn');
  if (btn) {
    btn.style.opacity = '1';
    btn.title = 'Sortează după distanță';
  }
}

/* ─── SHARE OFFER ──────────────────────────────────────── */
window.shareOffer = async function(title, businessName) {
  const url = window.location.href;
  const text = `${title} - ${businessName} pe OFAI`;

  if (navigator.share) {
    try {
      await navigator.share({ title: text, url });
      showToast('Partajat cu succes!', 'success');
    } catch (e) {
      if (e.name !== 'AbortError') {
        showToast('Nu s-a putut partaja.', 'error');
      }
    }
  } else {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copiat!', 'success');
    } catch (e) {
      // Fallback: select text from a temp input
      try {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Link copiat!', 'success');
      } catch (err) {
        showToast('Nu s-a putut copia link-ul. Încearcă din nou.', 'error');
      }
    }
  }
};

/* ─── SEARCH AUTOSUGGEST ───────────────────────────────── */
function initSearchAutosuggest() {
  // Search icon click → submit form
  document.querySelectorAll('.search-icon').forEach(icon => {
    icon.addEventListener('click', () => {
      const form = icon.closest('form');
      if (form) form.submit();
    });
  });

  const searchInputs = document.querySelectorAll('input[name="q"]');
  searchInputs.forEach((input) => {
    const form = input.closest('form');
    if (!form) return;

    // A11y attributes
    input.setAttribute('aria-label', 'Caută oferte și business-uri');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');

    form.style.position = 'relative';

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'search-suggest-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.id = 'search-suggest-' + Math.random().toString(36).slice(2, 8);
    input.setAttribute('aria-controls', dropdown.id);
    form.appendChild(dropdown);

    let debounceTimer = null;
    let searchAbortController = null;
    let activeIdx = -1;

    function setActiveItem(idx) {
      const items = dropdown.querySelectorAll('.search-suggest-item');
      items.forEach((el, i) => {
        el.classList.toggle('search-suggest-item--active', i === idx);
        if (i === idx) {
          el.setAttribute('aria-selected', 'true');
          el.scrollIntoView({ block: 'nearest' });
          input.setAttribute('aria-activedescendant', el.id || '');
        } else {
          el.removeAttribute('aria-selected');
        }
      });
      activeIdx = idx;
    }

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      activeIdx = -1;
      const q = input.value.trim();
      if (q.length < 2) {
        dropdown.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        if (searchAbortController) searchAbortController.abort();
        return;
      }
      dropdown.innerHTML = buildSkeletonHTML();
      dropdown.classList.add('open');
      input.setAttribute('aria-expanded', 'true');
      debounceTimer = setTimeout(() => fetchSuggestions(q, dropdown, (ctrl) => { searchAbortController = ctrl; }), 300);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2 && dropdown.innerHTML) {
        dropdown.classList.add('open');
        input.setAttribute('aria-expanded', 'true');
      }
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      if (!dropdown.classList.contains('open')) return;
      const items = dropdown.querySelectorAll('.search-suggest-item');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveItem(activeIdx < items.length - 1 ? activeIdx + 1 : 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveItem(activeIdx > 0 ? activeIdx - 1 : items.length - 1);
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        const activeEl = items[activeIdx];
        if (activeEl && activeEl.href) window.location.href = activeEl.href;
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        activeIdx = -1;
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!form.contains(e.target)) {
        dropdown.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        activeIdx = -1;
      }
    });
  });
}

function highlightMatch(text, query) {
  if (!query || !text) return escapeHtml(text || '');
  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp('(' + escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function tierBadgeSvg(badgeType, isVerified) {
  const bt = badgeType || (isVerified ? 'verified' : null);
  if (bt === 'premium') return ' <svg class="premium-badge-icon" width="14" height="14" viewBox="0 0 24 24" fill="#a78bfa"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>';
  if (bt === 'standard' || bt === 'verified') return ' <svg class="verified-badge" width="14" height="14" viewBox="0 0 24 24" fill="#fb923c"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>';
  return '';
}

async function fetchSuggestions(q, dropdown, setController) {
  try {
    const controller = new AbortController();
    if (setController) setController(controller);

    const resp = await fetch(`/api/web/search/suggest?q=${encodeURIComponent(q)}`, {
      signal: controller.signal
    });
    if (!resp.ok) return;
    const data = await resp.json();

    if (data.offers.length === 0 && data.businesses.length === 0) {
      dropdown.innerHTML = `<div class="search-suggest-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px;opacity:0.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        <div>Niciun rezultat pentru \u201E${escapeHtml(q)}\u201D</div>
        <div style="margin-top:4px">Încearcă alt termen sau <a href="/oferte">explorează toate ofertele</a></div>
      </div>`;
      dropdown.classList.add('open');
      return;
    }

    let html = '';
    let itemIdx = 0;

    if (data.offers.length > 0) {
      html += '<div class="search-suggest-section"><div class="search-suggest-label">Oferte</div>';
      data.offers.forEach((o) => {
        const discount = o.discount_type === 'percent' || o.discount_type === 'percentage'
          ? `-${o.discount_value}%`
          : `${o.discount_value} lei`;
        const oLogo = o.business_logo
          ? `<img src="${o.business_logo}" class="search-suggest-item-logo" alt="">`
          : `<div class="search-suggest-item-logo" style="display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--accent);">${escapeHtml((o.business_name || '?').charAt(0))}</div>`;
        html += `<a href="/oferta/${o.id}" class="search-suggest-item" role="option" id="suggest-item-${itemIdx++}">
          ${oLogo}
          <div class="search-suggest-item-text">
            <div class="search-suggest-item-title">${highlightMatch(o.title, q)}</div>
            <div class="search-suggest-item-sub">${highlightMatch(o.business_name, q)}${tierBadgeSvg(o.subscription_badge_type, o.business_verified)}</div>
          </div>
          <span class="search-suggest-item-badge">${discount}</span>
        </a>`;
      });
      html += '</div>';
    }

    if (data.businesses.length > 0) {
      html += '<div class="search-suggest-section"><div class="search-suggest-label">Business-uri</div>';
      data.businesses.forEach((b) => {
        const logo = b.logo_url
          ? `<img src="${b.logo_url}" class="search-suggest-item-logo" alt="">`
          : `<div class="search-suggest-item-logo" style="display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--accent);">${escapeHtml(b.name.charAt(0))}</div>`;
        html += `<a href="/business/${b.id}" class="search-suggest-item" role="option" id="suggest-item-${itemIdx++}">
          ${logo}
          <div class="search-suggest-item-text">
            <div class="search-suggest-item-title">${highlightMatch(b.name, q)}${tierBadgeSvg(b.subscription_badge_type, b.is_verified)}</div>
            <div class="search-suggest-item-sub">${highlightMatch(b.category_name || '', q)}</div>
          </div>
        </a>`;
      });
      html += '</div>';
    }

    // "View all results" link
    html += `<a href="/oferte?q=${encodeURIComponent(q)}" class="search-suggest-viewall">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      Vezi toate rezultatele pentru \u201E${escapeHtml(q)}\u201D
    </a>`;

    dropdown.innerHTML = html;
    dropdown.classList.add('open');
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error(e);
    if (showToast) showToast('Eroare la căutare. Încearcă din nou.', 'error');
    dropdown.classList.remove('open');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ─── TILTFX 3D CARD EFFECT ───────────────────────────── */
function initTiltFx() {
  if (window.innerWidth < 768) return;
  const card = document.querySelector('.offers-bento .offer-card.featured');
  if (!card) return;

  const glare = document.createElement('div');
  glare.className = 'tilt-glare';
  card.appendChild(glare);

  let rafId = null;
  card.addEventListener('mousemove', (e) => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotateY = (x - 0.5) * 8;
      const rotateX = (0.5 - y) * 8;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      glare.style.setProperty('--mx', (x * 100) + '%');
      glare.style.setProperty('--my', (y * 100) + '%');
    });
  });

  card.addEventListener('mouseleave', () => {
    if (rafId) cancelAnimationFrame(rafId);
    card.style.transform = '';
  });
}

/* ─── PARTICLE BACKGROUND (generic — hero + auth pages) ── */
function initParticles() {
  if (window.innerWidth < 768) return;
  document.querySelectorAll('canvas.particle-canvas').forEach(canvas => {
    const container = canvas.parentElement;
    if (!container) return;
    // Skip canvases claimed by WebGL shader (data-shader attr set in HTML)
    if (canvas.dataset.shader === 'true') return;
    setupParticleCanvas(canvas, container);
  });
}

function setupParticleCanvas(canvas, container) {
  const ctx = canvas.getContext('2d');
  let w, h, particles = [], mouse = { x: -1000, y: -1000 }, animating = true;

  function resize() {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    particles = [];
    const count = Math.min(Math.floor(w / 30), 50);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: 1 + Math.random() * 1.5,
        o: 0.15 + Math.random() * 0.2
      });
    }
  }

  function draw() {
    if (!animating) return;
    ctx.clearRect(0, 0, w, h);

    particles.forEach((p) => {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200 && dist > 1) {
        const force = 0.3 / dist;
        p.vx += dx * force * 0.01;
        p.vy += dy * force * 0.01;
      }

      p.vx *= 0.99;
      p.vy *= 0.99;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(251, 146, 60, ${p.o})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  container.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  const obs = new IntersectionObserver((entries) => {
    animating = entries[0].isIntersecting;
    if (animating) draw();
  }, { threshold: 0.1 });
  obs.observe(container);

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  resize();
  createParticles();
  draw();
}

/* ─── SKELETON SEARCH LOADING ──────────────────────────── */
function buildSkeletonHTML() {
  let html = '<div class="search-suggest-section">';
  for (let i = 0; i < 3; i++) {
    html += `<div class="search-suggest-item search-suggest-skeleton">
      <div class="skeleton" style="width:32px;height:32px;border-radius:8px;flex-shrink:0;"></div>
      <div class="search-suggest-item-text">
        <div class="skeleton" style="width:${60 + i * 15}%;height:14px;margin-bottom:6px;border-radius:4px;"></div>
        <div class="skeleton" style="width:40%;height:10px;border-radius:4px;"></div>
      </div>
    </div>`;
  }
  html += '</div>';
  return html;
}

/* ─── SCROLL ARROWS FOR HORIZONTAL CONTAINERS ────────── */
function initScrollArrows() {
  document.querySelectorAll('.scroll-container').forEach(container => {
    const scrollEl = container.querySelector('.filter-bar, .cities-scroll');
    const leftBtn = container.querySelector('.scroll-arrow-left');
    const rightBtn = container.querySelector('.scroll-arrow-right');
    if (!scrollEl || !leftBtn || !rightBtn) return;

    function updateArrows() {
      const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
      leftBtn.classList.toggle('visible', scrollLeft > 8);
      rightBtn.classList.toggle('visible', scrollLeft < scrollWidth - clientWidth - 8);
    }

    leftBtn.addEventListener('click', () => {
      scrollEl.scrollBy({ left: -200, behavior: 'smooth' });
    });
    rightBtn.addEventListener('click', () => {
      scrollEl.scrollBy({ left: 200, behavior: 'smooth' });
    });

    scrollEl.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);

    // Initial check after small delay (content may still be rendering)
    setTimeout(updateArrows, 100);
  });
}

/* ─── GALLERY LIGHTBOX ──────────────────────────────────── */
(function() {
  let galleryImages = [];
  let galleryIdx = 0;

  function updateGallery() {
    const mainImg = document.getElementById('gallery-main-img');
    const idxSpan = document.getElementById('gallery-idx');
    if (!mainImg || !galleryImages.length) return;
    mainImg.src = galleryImages[galleryIdx];
    if (idxSpan) idxSpan.textContent = galleryIdx + 1;

    // Update active thumbnail
    const thumbs = document.querySelectorAll('.gallery-thumb-item');
    thumbs.forEach((t, i) => {
      t.classList.toggle('active', i === galleryIdx);
    });
  }

  window.openGallery = function(startIdx) {
    const modal = document.getElementById('gallery-modal');
    if (!modal) return;

    // Collect image URLs from thumbnails
    galleryImages = [];
    modal.querySelectorAll('.gallery-thumb-item').forEach(t => {
      galleryImages.push(t.src);
    });
    galleryIdx = (typeof startIdx === 'number' && startIdx >= 0 && startIdx < galleryImages.length) ? startIdx : 0;
    updateGallery();

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.lenis) window.lenis.stop();
  };

  window.closeGallery = function() {
    const modal = document.getElementById('gallery-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.lenis) window.lenis.start();
  };

  window.galleryNext = function() {
    if (!galleryImages.length) return;
    galleryIdx = (galleryIdx + 1) % galleryImages.length;
    updateGallery();
  };

  window.galleryPrev = function() {
    if (!galleryImages.length) return;
    galleryIdx = (galleryIdx - 1 + galleryImages.length) % galleryImages.length;
    updateGallery();
  };

  window.galleryGoTo = function(i) {
    if (i < 0 || i >= galleryImages.length) return;
    galleryIdx = i;
    updateGallery();
  };

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('gallery-modal');
    if (!modal || !modal.classList.contains('open')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeGallery();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      galleryNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      galleryPrev();
    }
  });
})();

/* ─── HELPER: Extract business ID from page context ───── */
function extractBusinessIdFromContext() {
  // Try to find business ID from data attributes on the page
  const followBtn = document.querySelector('[data-business-id]');
  if (followBtn) {
    return parseInt(followBtn.getAttribute('data-business-id'), 10);
  }
  // Fallback: parse from URL pattern /business/:id or /oferta/:id
  const match = window.location.pathname.match(/\/(business|oferta)\/(\d+)/);
  if (match) {
    // For offer pages, we need to extract business_id from the sidebar link
    const bizLink = document.querySelector('a[href^="/business/"]');
    if (bizLink) {
      const bizMatch = bizLink.getAttribute('href').match(/\/business\/(\d+)/);
      if (bizMatch) return parseInt(bizMatch[1], 10);
    }
  }
  return null;
}

/* ─── SHARED AUTH FORM HANDLER ──────────────────────────── */
window.submitAuthForm = function(config) {
  const { formEl, endpoint, getPayload, successRedirect, onSuccess } = config;
  if (!formEl) return;

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = formEl.querySelector('.auth-submit, button[type="submit"]');
    if (!btn) return;

    // Batch all DOM changes to prevent reflow flash
    requestAnimationFrame(function() {
      // Fade out old error messages (if any)
      var oldErr = formEl.parentElement.querySelector('.auth-error');
      if (oldErr) oldErr.remove();

      // Show loading state
      btn.disabled = true;
      btn.textContent = btn.dataset.loadingText || 'Se procesează...';
    });

    var originalText = btn.textContent;

    try {
      var payload = getPayload(formEl);
      var resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken(),
        },
        body: JSON.stringify(payload),
      });
      var data = await resp.json();

      if (resp.ok && data.success) {
        if (onSuccess) onSuccess(data);
        // Smooth fade-out before redirect
        var card = formEl.closest('.auth-card');
        if (card) {
          card.style.transition = 'opacity 0.2s, transform 0.2s';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.98)';
        }
        setTimeout(function() {
          window.location.href = data.redirect || successRedirect;
        }, 200);
      } else {
        // Show error message
        var errDiv = document.createElement('div');
        errDiv.className = 'auth-error show';
        errDiv.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ' + escapeHtml(data.message || 'Eroare');
        formEl.parentElement.insertBefore(errDiv, formEl);
        btn.disabled = false;
        btn.textContent = originalText;
      }
    } catch (err) {
      var errDiv = document.createElement('div');
      errDiv.className = 'auth-error show';
      errDiv.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Eroare de rețea. Verifică conexiunea la internet.';
      formEl.parentElement.insertBefore(errDiv, formEl);
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
};
