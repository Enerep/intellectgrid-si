/* A local-only experiment. The inquiry form prepares a draft and never submits data. */
(() => {
  'use strict';
  const config = window.SITE_CONFIG;
  const sculpture = window.IntellectSculpture;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = document.querySelector('#motion-toggle');
  const soundButton = document.querySelector('#sound-toggle');
  const status = document.querySelector('#experiment-status');
  const disorder = document.querySelector('#disorder');
  const shapeButtons = [...document.querySelectorAll('button[data-shape]')];
  const shapeNames = { knot: 'Entanglement', orbit: 'Orbital thinking', lattice: 'A common thread' };
  const shapeKeys = Object.keys(shapeNames);
  let paused = motionPreference.matches;
  let audio = null;
  let soundOn = false;
  let burstTimer = null;
  let opener = null;
  let inquiry = null;

  document.body.classList.add('is-ready');
  document.querySelectorAll('[data-contact]').forEach(link => { link.href = `mailto:${config.contactEmail}`; });
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    document.querySelectorAll('[data-sister]').forEach(link => { link.href = `${window.location.protocol}//${window.location.hostname}:4312`; });
  }
  function syncMotion() {
    const temporarilyPaused = paused || !!document.querySelector('dialog[open]');
    sculpture?.setPaused(temporarilyPaused);
    document.body.classList.toggle('is-paused', temporarilyPaused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    if (audio) audio.master.gain.setTargetAtTime(soundOn && !temporarilyPaused && !document.hidden ? 0.045 : 0, audio.context.currentTime, 0.15);
  }
  function toggleMotion() { paused = !paused; syncMotion(); }
  motionButton.addEventListener('click', toggleMotion);
  motionPreference.addEventListener('change', event => { paused = event.matches; syncMotion(); });
  document.addEventListener('visibilitychange', syncMotion);
  syncMotion();

  function playNotes(notes, duration = 0.6) {
    if (!audio || !soundOn || paused || document.hidden) return;
    const now = audio.context.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = audio.context.createOscillator();
      const gain = audio.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.17, now + index * 0.07 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + index * 0.07);
      oscillator.connect(gain).connect(audio.master);
      oscillator.start(now + index * 0.07);
      oscillator.stop(now + duration + index * 0.07 + 0.1);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
  soundButton.addEventListener('click', async () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { status.textContent = 'Sound is unavailable in this browser.'; return; }
      if (!audio) {
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        audio = { context, master };
      }
      await audio.context.resume();
      soundOn = !soundOn;
      soundButton.setAttribute('aria-pressed', String(soundOn));
      soundButton.querySelector('span').textContent = soundOn ? 'Sound on' : 'Sound off';
      syncMotion();
      if (soundOn) playNotes([130.81, 196, 261.63], 1.8);
    } catch { status.textContent = 'Sound could not start. You can still explore the sculpture.'; }
  });
  function setShape(next) {
    sculpture?.setShape(next);
    const number = String(shapeKeys.indexOf(next) + 1).padStart(2, '0');
    shapeButtons.forEach(button => {
      const active = button.dataset.shape === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('#sculpture-caption').textContent = `STUDY ${number} — ${shapeNames[next].toUpperCase()}`;
    document.querySelector('#study-meta').textContent = `${number} / ${shapeNames[next].toUpperCase()}`;
    status.textContent = `${shapeNames[next]} selected.`;
    const base = next === 'knot' ? 130.81 : next === 'orbit' ? 146.83 : 164.81;
    playNotes([base, base * 1.5, base * 2], 1.4);
  }
  shapeButtons.forEach(button => button.addEventListener('click', () => setShape(button.dataset.shape)));
  disorder.addEventListener('input', () => {
    const value = Number(disorder.value);
    document.querySelector('#disorder-value').textContent = `${String(value).padStart(2, '0')}%`;
    sculpture?.setTension?.(value / 100);
  });
  function burst() {
    sculpture?.burst();
    const button = document.querySelector('#burst-button');
    button.classList.add('is-bursting');
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => button.classList.remove('is-bursting'), 1600);
    playNotes([65.41, 98, 130.81, 261.63], 2);
    status.textContent = 'Pattern unravelled. Finding a new connection.';
  }
  document.querySelector('#burst-button').addEventListener('click', burst);
  function reset() {
    sculpture?.reset();
    disorder.value = '0';
    document.querySelector('#disorder-value').textContent = '00%';
    sculpture?.setTension?.(0);
    setShape('knot');
    status.textContent = 'View reset.';
  }
  document.querySelector('#reset-view').addEventListener('click', reset);
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || document.querySelector('dialog[open]')) return;
    if (event.target.closest('input, textarea, select, [contenteditable=true]')) return;
    const key = event.key.toLowerCase();
    if (key === ' ' && event.target.closest('button, a')) return;
    if (['1', '2', '3'].includes(key)) setShape(shapeKeys[Number(key) - 1]);
    else if (key === ' ') { event.preventDefault(); burst(); }
    else if (key === 'p') toggleMotion();
    else if (key === 'r') reset();
    else if (key === 'arrowleft' || key === 'arrowright') { event.preventDefault(); sculpture?.rotate?.(key === 'arrowleft' ? -0.2 : 0.2); }
  });
  function openDialog(dialog, trigger) {
    opener = trigger;
    dialog.showModal();
    document.body.classList.add('dialog-open');
    syncMotion();
  }
  document.querySelectorAll('[data-inquire]').forEach(button => button.addEventListener('click', () => openDialog(document.querySelector('#inquiry-dialog'), button)));
  document.querySelectorAll('[data-about]').forEach(button => button.addEventListener('click', () => openDialog(document.querySelector('#about-dialog'), button)));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      syncMotion();
      opener?.focus({ preventScroll: true });
    });
  });
  const form = document.querySelector('#inquiry-form');
  const result = document.querySelector('#inquiry-result');
  const inquiryStatus = document.querySelector('#inquiry-status');
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    if (!name) { form.elements.name.setCustomValidity('Please enter your name.'); form.elements.name.reportValidity(); return; }
    const amount = data.get('offer');
    const offer = amount ? `USD ${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Open to a conversation';
    inquiry = {
      subject: `Domain inquiry: ${config.domain}`,
      body: `Hello,\n\nI’m interested in acquiring ${config.domain}.\n\nName: ${name}\nEmail: ${String(data.get('email')).trim()}\nOffer: ${offer}\n\n${String(data.get('message')).trim() || 'I would love to discuss the domain and next steps.'}\n\nThank you,\n${name}`,
    };
    document.querySelector('#email-inquiry').href = `mailto:${config.contactEmail}?subject=${encodeURIComponent(inquiry.subject)}&body=${encodeURIComponent(inquiry.body)}`;
    document.querySelector('#webmail-inquiry').href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(config.contactEmail)}&su=${encodeURIComponent(inquiry.subject)}&body=${encodeURIComponent(inquiry.body)}`;
    result.hidden = false;
    inquiryStatus.textContent = 'Your draft is ready. Open your email app, use Gmail, or copy it below.';
    document.querySelector('#email-inquiry').focus({ preventScroll: true });
    result.scrollIntoView({ block: 'nearest', behavior: motionPreference.matches ? 'instant' : 'smooth' });
  });
  form.addEventListener('input', () => {
    form.elements.name.setCustomValidity('');
    inquiry = null;
    result.hidden = true;
    inquiryStatus.textContent = '';
  });
  document.querySelector('#copy-inquiry').addEventListener('click', async () => {
    if (!inquiry) return;
    const text = `To: ${config.contactEmail}\nSubject: ${inquiry.subject}\n\n${inquiry.body}`;
    try {
      await navigator.clipboard.writeText(text);
      inquiryStatus.textContent = 'Draft copied. Paste it into an email and send when you’re ready.';
    } catch {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `${config.domain}-inquiry.txt`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      inquiryStatus.textContent = 'Your draft was downloaded as a text file.';
    }
  });
})();
