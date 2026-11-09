(() => {
  'use strict';

  const stages = ['intro', 'stars', 'cake', 'art', 'card'];
  const stageElements = Object.fromEntries(stages.map(id => [id, document.getElementById(id)]));
  const $ = id => document.getElementById(id);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let currentStage = 'intro';
  let pickedStars = 0;
  let candleBlown = false;
  let cardOpened = false;
  let audioContext;
  let masterAudio;
  let musicTimer;
  let nextMusicLoop = 0;
  let audioUnlocked = false;
  let revealTimer;

  // A small, seeded star field. All particles are decoration and cannot be focused.
  const background = $('backgroundStars');
  let seed = 19;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  for (let i = 0; i < 56; i++) {
    const star = document.createElement('i');
    star.className = 'sky-dot';
    star.style.left = `${(random() * 100).toFixed(2)}%`;
    star.style.top = `${(random() * 100).toFixed(2)}%`;
    star.style.setProperty('--speed', `${(2.7 + random() * 5).toFixed(1)}s`);
    star.style.setProperty('--delay', `${(-random() * 7).toFixed(1)}s`);
    background.append(star);
  }

  // Original, continuously looping, very soft background music, synthesized in the browser.
  // Browsers block audible autoplay before a gesture: the first touch/key press unlocks it.
  // There is no music toggle, so it remains on while the surprise is being enjoyed.
  function unlockAudio() {
    if (audioUnlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioContext = new AC();
      masterAudio = audioContext.createGain();
      masterAudio.gain.value = 0.82;
      const limiter = audioContext.createDynamicsCompressor();
      limiter.threshold.value = -20;
      limiter.knee.value = 12;
      limiter.ratio.value = 3;
      masterAudio.connect(limiter).connect(audioContext.destination);
      audioUnlocked = true;
      audioContext.resume().then(() => {
        $('musicStatus').classList.add('is-playing');
        $('soundLabel').textContent = 'Music on';
        startAmbientMusic();
      }).catch(() => {});
    } catch (_) { /* If unsupported, the entire experience still works silently. */ }
  }
  document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
  document.addEventListener('keydown', unlockAudio, { once: true, capture: true });

  // Lower-case, bell-like voice with a slow attack. No files, external APIs, or licenses needed.
  function musicTone(frequency, start, duration, volume, type = 'sine') {
    if (!audioContext || !masterAudio) return;
    const tone = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    tone.type = type;
    tone.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(.13, duration * .24));
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * .33), start + duration * .6);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    tone.connect(envelope).connect(masterAudio);
    tone.start(start);
    tone.stop(start + duration + .035);
  }
  function startAmbientMusic() {
    if (musicTimer || !audioContext) return;
    nextMusicLoop = audioContext.currentTime + .16;
    const beat = 60 / 90;
    const melody = [
      [0,659.25,.65], [1,783.99,.48], [1.8,880,.8], [3,783.99,.65],
      [4,698.46,.65], [5,783.99,.5], [5.8,659.25,.75], [7,587.33,.66],
      [8,659.25,.7], [9,783.99,.48], [9.8,987.77,.75], [11,880,.72],
      [12,783.99,.7], [13,698.46,.55], [13.8,659.25,.7], [15,523.25,.8]
    ];
    const chords = [
      [261.63,329.63,392], [261.63,349.23,440],
      [220,261.63,329.63], [196,293.66,392]
    ];
    function schedule() {
      if (audioContext.state !== 'running') return;
      const now = audioContext.currentTime;
      if (nextMusicLoop < now - .25) nextMusicLoop = now + .1;
      while (nextMusicLoop < now + 1.8) {
        melody.forEach(([index, pitch, length]) => {
          musicTone(pitch, nextMusicLoop + index * beat, length * beat + .18, .026);
        });
        chords.forEach((notes, i) => notes.forEach((pitch, j) => {
          musicTone(pitch, nextMusicLoop + i * 4 * beat, 4.12 * beat, j === 0 ? .008 : .006);
        }));
        nextMusicLoop += 16 * beat;
      }
    }
    schedule();
    musicTimer = window.setInterval(schedule, 650);
  }

  // Event chimes sit clearly above the continuous soundtrack.
  function playNotes(notes, kind = 'sine') {
    if (!audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    notes.forEach(([frequency, delay = 0, duration = .28], index) => {
      musicTone(frequency, now + delay, duration, index === 0 ? .09 : .071, kind);
    });
  }
  const softChime = () => playNotes([[523,0,.3],[659,.10,.31],[784,.22,.5]]);
  const happyChime = () => playNotes([[523,0,.24],[659,.12,.24],[784,.24,.26],[1046,.38,.7]]);

  // Gentle, original fireworks made from tiny filtered noise pops and sparkling bells.
  // It sounds like a soft fizzy celebration rather than a loud bang.
  function softFireworks() {
    if (!audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    const sampleRate = audioContext.sampleRate;
    const duration = .13;
    const buffer = audioContext.createBuffer(1, Math.ceil(duration * sampleRate), sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1);
    const pops = [0,.12,.21,.34,.47,.58,.72,.86,1.02,1.17,1.36,1.51];
    pops.forEach((offset, i) => {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 950 + (i % 4) * 310;
      const envelope = audioContext.createGain();
      const t = now + offset;
      envelope.gain.setValueAtTime(.0001, t);
      envelope.gain.exponentialRampToValueAtTime(.024 + (i % 3) * .004, t + .006);
      envelope.gain.exponentialRampToValueAtTime(.0001, t + .11);
      source.connect(filter).connect(envelope).connect(masterAudio);
      source.start(t);
      source.stop(t + duration);
      if (i % 2 === 0) {
        musicTone([1046.5,1174.66,1318.51,1567.98][i % 4], t + .016, .20, .035);
      }
    });
    playNotes([[784,0,.28],[1046.5,.22,.33],[1318.5,.45,.43],[1568,.71,.63]]);
  }

  // Some browsers suspend audio in background tabs; continue when the page is active again.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !audioContext || !audioUnlocked) return;
    audioContext.resume().catch(() => {});
  });

  function showStage(name) {
    if (!stageElements[name]) return;
    stages.forEach(id => { stageElements[id].hidden = id !== name; });
    currentStage = name;
    if (name === 'stars') updateStarGuide();
    const number = stages.indexOf(name);
    $('stepTracker').hidden = number === 0;
    if (number > 0) {
      $('stepCaption').textContent = `0${number} / 04`;
      document.querySelectorAll('.step-bar').forEach((bar, i) => {
        bar.classList.toggle('is-done', i < number);
      });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    const heading = stageElements[name].querySelector('h1, h2');
    if (heading && number > 0) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  // Confetti is drawn to one fixed canvas, so it stays fast on mobile devices.
  const particlesCanvas = $('confettiCanvas');
  const pctx = particlesCanvas.getContext('2d');
  let particles = [];
  let animationId = 0;
  let dpr = 1;
  const colors = ['#ff92b7', '#ffc680', '#a49afe', '#83d8d2', '#fff1bf', '#f7d5e7'];

  function resizeConfetti() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    particlesCanvas.width = Math.round(window.innerWidth * dpr);
    particlesCanvas.height = Math.round(window.innerHeight * dpr);
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeConfetti();
  window.addEventListener('resize', resizeConfetti, { passive: true });

  function burst(x = innerWidth / 2, y = innerHeight / 2, count = 100, spread = 1) {
    if (prefersReducedMotion.matches) return;
    if (particles.length > 380) particles = particles.slice(-200);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (1.6 + Math.random() * 6.3) * spread;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
        size: 3 + Math.random() * 5.5, color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 6, spin: (Math.random() - .5) * .16,
        life: 0, maxLife: 54 + Math.random() * 50, circle: Math.random() > .74
      });
    }
    if (!animationId) animationId = requestAnimationFrame(animateConfetti);
  }
  function animateConfetti() {
    pctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles = particles.filter(particle => particle.life < particle.maxLife);
    for (const p of particles) {
      p.life++;
      p.vy += .095;
      p.vx *= .994;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      const alpha = Math.min(1, (p.maxLife - p.life) / 20);
      pctx.save();
      pctx.translate(p.x, p.y);
      pctx.rotate(p.rotation);
      pctx.globalAlpha = alpha;
      pctx.fillStyle = p.color;
      if (p.circle) {
        pctx.beginPath();
        pctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        pctx.fill();
      } else {
        pctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .62);
      }
      pctx.restore();
    }
    if (particles.length) animationId = requestAnimationFrame(animateConfetti);
    else { animationId = 0; pctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  $('startButton').addEventListener('click', () => {
    softChime();
    burst(innerWidth * .5, innerHeight * .42, 60, 1);
    showStage('stars');
  });

  // Step 1: choose exactly three stars.
  const pickableStars = [...document.querySelectorAll('.pick-star')];
  function updateStarGuide() {
    pickableStars.forEach(star => star.classList.remove('is-guided'));
    const next = pickableStars.find(star => !star.classList.contains('is-picked') && !star.disabled);
    if (next && pickedStars < 3) next.classList.add('is-guided');
  }
  pickableStars.forEach(button => {
    button.addEventListener('click', () => {
      if (pickedStars >= 3 || button.classList.contains('is-picked')) return;
      button.classList.add('is-picked');
      button.setAttribute('aria-pressed', 'true');
      button.disabled = true;
      pickedStars++;
      updateStarGuide();
      const rect = button.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 38, .65);
      playNotes([[659 + pickedStars * 95, 0, .38]]);
      $('starFeedback').textContent = pickedStars === 3
        ? 'Wow! You made the sky sparkle! ✨'
        : `${pickedStars} of 3 stars ✦`;
      if (pickedStars === 3) {
        pickableStars.forEach(star => { star.disabled = true; });
        $('starsNext').disabled = false;
        happyChime();
      }
    });
  });
  $('starsNext').addEventListener('click', () => { showStage('cake'); softChime(); });

  // Step 2: one birthday candle.
  $('candleButton').addEventListener('click', () => {
    if (candleBlown) return;
    candleBlown = true;
    $('cakeScene').classList.add('is-blown');
    $('candleButton').disabled = true;
    $('cakeNext').disabled = false;
    $('cakeFeedback').textContent = 'Your wish is on its way! 💫';
    burst(innerWidth * .5, Math.max(180, innerHeight * .49), 155, 1.3);
    happyChime();
  });
  $('cakeNext').addEventListener('click', () => { showStage('art'); softChime(); });

  // Step 3: simple painter. Strokes are kept in memory for a working Undo.
  const canvas = $('drawingCanvas');
  const drawCtx = canvas.getContext('2d');
  const brushes = [...document.querySelectorAll('.color-swatch')];
  const strokes = [];
  let activeStroke = null;
  let brushColor = '#f4779b';
  let paintedImage = '';

  function paintBackground() {
    drawCtx.fillStyle = '#fffefd';
    drawCtx.fillRect(0, 0, canvas.width, canvas.height);
  }
  function paintStroke(stroke) {
    const points = stroke.points;
    if (!points.length) return;
    drawCtx.lineWidth = 7;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.strokeStyle = stroke.color;
    drawCtx.fillStyle = stroke.color;
    if (points.length === 1) {
      drawCtx.beginPath();
      drawCtx.arc(points[0].x, points[0].y, 3.5, 0, Math.PI * 2);
      drawCtx.fill();
      return;
    }
    drawCtx.beginPath();
    drawCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) drawCtx.lineTo(points[i].x, points[i].y);
    drawCtx.stroke();
  }
  function redraw() {
    paintBackground();
    strokes.forEach(paintStroke);
    $('undoDrawing').disabled = strokes.length === 0;
  }
  function getPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height)
    };
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    activeStroke = { color: brushColor, points: [getPoint(event)] };
    strokes.push(activeStroke);
    redraw();
  });
  canvas.addEventListener('pointermove', event => {
    if (!activeStroke) return;
    activeStroke.points.push(getPoint(event));
    redraw();
  });
  function stopDrawing() { activeStroke = null; }
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);
  canvas.addEventListener('lostpointercapture', stopDrawing);
  brushes.forEach(brush => brush.addEventListener('click', () => {
    brushColor = brush.dataset.color;
    brushes.forEach(item => {
      const selected = item === brush;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
  }));
  $('undoDrawing').addEventListener('click', () => { strokes.pop(); redraw(); });
  $('clearDrawing').addEventListener('click', () => { strokes.length = 0; redraw(); });
  paintBackground();

  $('artNext').addEventListener('click', () => {
    paintedImage = strokes.length ? canvas.toDataURL('image/png') : '';
    $('personalArt').hidden = !paintedImage;
    if (paintedImage) $('artPreview').src = paintedImage;
    else $('artPreview').removeAttribute('src');
    softChime();
    showStage('card');
  });

  // Step 4: a real interactive envelope that opens before the letter appears.
  $('openCardButton').addEventListener('click', () => {
    if (cardOpened) return;
    cardOpened = true;
    $('openCardButton').disabled = true;
    $('cardReveal').classList.add('is-opening');
    softChime();
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      $('cardReveal').classList.add('is-open');
      burst(innerWidth / 2, innerHeight * .35, 200, 1.6);
      softFireworks();
      $('letterCard').focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'instant' : 'smooth' });
    }, prefersReducedMotion.matches ? 40 : 630);
  });

  $('downloadArt').addEventListener('click', () => {
    if (!paintedImage) return;
    const link = document.createElement('a');
    link.href = paintedImage;
    link.download = 'hanan-little-masterpiece.png';
    document.body.append(link);
    link.click();
    link.remove();
  });

  function resetSurprise() {
    clearTimeout(revealTimer);
    pickedStars = 0;
    candleBlown = false;
    cardOpened = false;
    paintedImage = '';
    pickableStars.forEach(star => {
      star.disabled = false;
      star.classList.remove('is-picked', 'is-guided');
      star.setAttribute('aria-pressed', 'false');
    });
    $('starFeedback').textContent = '0 of 3 stars ✦';
    $('starsNext').disabled = true;
    $('cakeScene').classList.remove('is-blown');
    $('candleButton').disabled = false;
    $('cakeNext').disabled = true;
    $('cakeFeedback').textContent = '✧ ✦ ✧';
    $('cardReveal').classList.remove('is-opening', 'is-open');
    $('openCardButton').disabled = false;
    $('personalArt').hidden = true;
    $('artPreview').removeAttribute('src');
    strokes.length = 0;
    redraw();
    brushColor = '#f4779b';
    brushes.forEach((item, index) => {
      item.classList.toggle('is-selected', index === 0);
      item.setAttribute('aria-pressed', String(index === 0));
    });
    showStage('intro');
  }
  $('restartButton').addEventListener('click', () => { resetSurprise(); softChime(); });
})();
