/* ═══════════════════════════════════════════════════════════
   OFAI.ro — Main JavaScript
   Scroll reveal, navbar logic, counters, interactions
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollReveal();
  initCounters();
  initMobileMenu();
  initSmoothScroll();
  initGeolocation();
});

/* ─── NAVBAR ─────────────────────────────────────────────── */
function initNavbar() {
  const wrapper = document.querySelector('.navbar-wrapper');
  if (!wrapper) return;

  let lastScroll = 0;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const currentScroll = window.scrollY;

        // Add/remove scrolled class
        if (currentScroll > 20) {
          wrapper.classList.add('scrolled');
        } else {
          wrapper.classList.remove('scrolled');
        }

        // Hide/show on scroll direction (only after 300px)
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
        ticking = false;
      });
      ticking = true;
    }
  });
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
    document.body.style.overflow = overlay.classList.contains('open') ? 'hidden' : '';
  });

  // Close on link click
  overlay.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
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
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
};

/* ─── FAVORITE TOGGLE ───────────────────────────────────── */
window.toggleFavorite = async function(offerId) {
  const btn = document.querySelector(`.bookmark-btn[data-offer-id="${offerId}"]`);
  if (!btn) return;

  const isFav = btn.dataset.favorited === 'true';

  try {
    if (isFav) {
      const resp = await fetch(`/api/web/favorites/${offerId}`, { method: 'DELETE' });
      if (!resp.ok) {
        const data = await resp.json();
        if (resp.status === 401) return window.location.href = '/login';
        throw new Error(data.message);
      }
      btn.dataset.favorited = 'false';
      btn.classList.remove('is-favorited');
      showToast('Eliminat din favorite', 'info');
    } else {
      const resp = await fetch('/api/web/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        if (resp.status === 401) return window.location.href = '/login';
        throw new Error(data.message);
      }
      btn.dataset.favorited = 'true';
      btn.classList.add('is-favorited');
      showToast('Adăugat la favorite!', 'success');
    }
  } catch (err) {
    showToast(err.message || 'Eroare la favorite', 'error');
  }
};

/* ─── FOLLOW / UNFOLLOW TOGGLE ──────────────────────────── */
window.toggleFollow = async function(businessId) {
  const btn = document.querySelector(`.bd-follow-btn[data-business-id="${businessId}"]`);
  if (!btn) return;

  const isFollowing = btn.dataset.following === 'true';

  try {
    if (isFollowing) {
      const resp = await fetch(`/api/web/subscriptions/${businessId}`, { method: 'DELETE' });
      if (!resp.ok) {
        const data = await resp.json();
        if (resp.status === 401) return window.location.href = '/login';
        throw new Error(data.message);
      }
      btn.dataset.following = 'false';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> Urmărește';
      btn.classList.remove('following');
      showToast('Nu mai urmărești acest business', 'info');
    } else {
      const resp = await fetch('/api/web/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        if (resp.status === 401) return window.location.href = '/login';
        throw new Error(data.message);
      }
      btn.dataset.following = 'true';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Urmărești';
      btn.classList.add('following');
      showToast('Urmărești acest business!', 'success');
    }
  } catch (err) {
    showToast(err.message || 'Eroare', 'error');
  }
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
  var cards = document.querySelectorAll('.offer-distance[data-lat][data-lng]');
  if (cards.length === 0) return;
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(function(pos) {
    var userLat = pos.coords.latitude;
    var userLng = pos.coords.longitude;
    updateDistances(userLat, userLng, cards);
  }, function() {}, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

function haversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function formatDistance(km) {
  if (km < 1) return Math.round(km * 1000) + ' m';
  return km.toFixed(1) + ' km';
}

function updateDistances(userLat, userLng, cards) {
  cards.forEach(function(el) {
    var lat = parseFloat(el.dataset.lat);
    var lng = parseFloat(el.dataset.lng);
    if (isNaN(lat) || isNaN(lng)) return;
    var km = haversineKm(userLat, userLng, lat, lng);
    var text = el.querySelector('.offer-distance-text');
    if (text) {
      text.textContent = formatDistance(km);
      el.style.display = '';
    }
  });
}
