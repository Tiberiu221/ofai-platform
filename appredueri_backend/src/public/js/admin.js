// Admin Panel JavaScript
// Toast notifications, confirm dialogs, and sidebar navigation

document.addEventListener('DOMContentLoaded', () => {
  initToasts();
  initConfirmDialogs();
  initSidebarActive();
});

// ============================================
// Toast System
// ============================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function adminToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.warn('Toast container not found');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `a-toast a-toast-${type}`;

  // Icon based on type
  let icon = '';
  if (type === 'success') {
    icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (type === 'error') {
    icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else if (type === 'warning') {
    icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else if (type === 'info') {
    icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  toast.innerHTML = `
    <div class="a-toast-icon">${icon}</div>
    <div class="a-toast-message">${escapeHtml(message)}</div>
    <button class="a-toast-close" onclick="dismissToast(this)">&times;</button>
  `;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('a-toast-show'), 10);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    dismissToast(toast);
  }, 5000);
}

function dismissToast(element) {
  const toast = element.tagName === 'BUTTON' ? element.parentElement : element;
  toast.classList.remove('a-toast-show');
  toast.classList.add('a-toast-hide');
  setTimeout(() => toast.remove(), 300);
}

function initToasts() {
  // Check URL params for message/error and show toast
  const urlParams = new URLSearchParams(window.location.search);
  const message = urlParams.get('message');
  const error = urlParams.get('error');

  if (message) {
    adminToast(decodeURIComponent(message), 'success');
    cleanUrlParams(['message']);
  }

  if (error) {
    adminToast(decodeURIComponent(error), 'error');
    cleanUrlParams(['error']);
  }
}

function cleanUrlParams(paramsToRemove) {
  const url = new URL(window.location.href);
  paramsToRemove.forEach(param => url.searchParams.delete(param));
  window.history.replaceState({}, document.title, url.pathname + url.search);
}

// ============================================
// Confirm Dialog System
// ============================================

let confirmCallback = null;

function adminConfirm(message, callback) {
  const modal = document.getElementById('confirm-modal');
  const messageEl = document.getElementById('confirm-message');
  const okBtn = document.getElementById('confirm-ok-btn');

  if (!modal || !messageEl || !okBtn) {
    console.warn('Confirm modal elements not found');
    return;
  }

  messageEl.textContent = message;
  modal.style.display = 'flex';
  confirmCallback = callback;

  // Set up OK button click
  okBtn.onclick = () => {
    if (confirmCallback) {
      confirmCallback();
    }
    closeConfirmModal();
  };
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  confirmCallback = null;
}

function initConfirmDialogs() {
  // Find all forms with data-confirm attribute
  document.querySelectorAll('form[data-confirm]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = form.getAttribute('data-confirm');
      adminConfirm(message, () => {
        form.submit();
      });
    });
  });

  // Close modal on overlay click
  const modal = document.getElementById('confirm-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeConfirmModal();
      }
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeConfirmModal();
    }
  });
}

// ============================================
// Sidebar Active State
// ============================================

function initSidebarActive() {
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll('.a-nav-item');

  navItems.forEach(item => {
    const href = item.getAttribute('href');

    // Exact match for dashboard
    if (href === '/admin/dashboard' && currentPath === '/admin/dashboard') {
      item.classList.add('active');
    }
    // Prefix match for other pages
    else if (href !== '/admin/dashboard' && currentPath.startsWith(href)) {
      item.classList.add('active');
    }
  });
}

// ============================================
// Utility Functions (exposed globally)
// ============================================

window.adminToast = adminToast;
window.adminConfirm = adminConfirm;
window.closeConfirmModal = closeConfirmModal;
window.dismissToast = dismissToast;
