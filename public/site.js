/* Native browser interactions. No libraries, telemetry, or network submissions. */
(() => {
  'use strict';
  const config = window.SITE_CONFIG;
  const dialog = document.querySelector('#inquiry-dialog');
  const form = document.querySelector('#inquiry-form');
  const menuToggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#mobile-nav');
  const status = document.querySelector('#inquiry-status');
  let inquiry = null;
  let returnFocus = null;

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
  document.querySelectorAll('[data-contact]').forEach(el => {
    el.href = `mailto:${config.contactEmail}`;
    if (el.classList.contains('dialog-email')) el.textContent = config.contactEmail;
  });

  function closeMenu() {
    menu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
  }
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  menu.querySelectorAll('a').forEach(el => el.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuToggle.focus(); }
  });
  document.addEventListener('click', event => {
    if (!menu.hidden && !menu.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  document.querySelectorAll('[data-inquire]').forEach(button => button.addEventListener('click', () => {
    returnFocus = button.closest('#mobile-nav') ? menuToggle : button;
    closeMenu();
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }));
  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    if (returnFocus) returnFocus.focus({ preventScroll: true });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const email = String(data.get('email')).trim();
    if (!name) { form.elements.name.setCustomValidity('Please enter your name.'); form.elements.name.reportValidity(); return; }
    const amount = data.get('offer');
    const offer = amount ? `Offer: USD ${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Offer: Let’s discuss';
    inquiry = {
      subject: `Domain inquiry: ${config.domain}`,
      body: `Hello,\n\nI’m interested in acquiring ${config.domain}.\n\nName: ${name}\nEmail: ${email}\n${offer}\n\n${String(data.get('message')).trim() || 'I would love to discuss the domain and next steps.'}\n\nThank you,\n${name}`,
    };
    const query = `subject=${encodeURIComponent(inquiry.subject)}&body=${encodeURIComponent(inquiry.body)}`;
    document.querySelector('#webmail-inquiry').href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(config.contactEmail)}&su=${encodeURIComponent(inquiry.subject)}&body=${encodeURIComponent(inquiry.body)}`;
    document.querySelector('#inquiry-result').hidden = false;
    status.textContent = 'Your inquiry is ready. Send it from your email app. If your app didn’t open, use Gmail or copy the inquiry below.';
    window.location.href = `mailto:${config.contactEmail}?${query}`;
  });
  form.elements.name.addEventListener('input', () => form.elements.name.setCustomValidity(''));
  form.addEventListener('input', () => {
    inquiry = null;
    document.querySelector('#inquiry-result').hidden = true;
    status.textContent = '';
  });

  document.querySelector('#copy-inquiry').addEventListener('click', async () => {
    if (!inquiry) return;
    const text = `To: ${config.contactEmail}\nSubject: ${inquiry.subject}\n\n${inquiry.body}`;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      status.textContent = 'Inquiry copied. Paste it into an email to the owner and send when you’re ready.';
    } catch {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${config.domain}-inquiry.txt`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Clipboard unavailable. Your inquiry was downloaded as a text file instead.';
    }
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    document.body.classList.add('has-reveal');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.name-layout, .domain-strip, .possibilities-heading, .possibility-card, .acquire-section h2').forEach(el => {
      el.setAttribute('data-reveal', ''); observer.observe(el);
    });
  }
})();
