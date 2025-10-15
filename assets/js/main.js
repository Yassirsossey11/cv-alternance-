(function () {
  const root = document.documentElement;
  const themeToggle = document.querySelector('.theme-toggle');
  const navToggle = document.querySelector('.nav__toggle');
  const navList = document.getElementById('nav-list');
  const cvButton = document.getElementById('cv-download');
  const yearSpan = document.getElementById('year');
  const starsCanvas = document.getElementById('stars-canvas');
  const mistCanvas = document.getElementById('mist-canvas');
  let mouseNx = 0.5, mouseNy = 0.5; // normalized mouse (0..1)

  // Year
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Theme
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme === 'light') {
    document.body.classList.add('light');
  }
  themeToggle?.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
    // Force immediate refresh of parallax/animations after theme switch
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('scroll'));
  });

  // Mobile nav
  navToggle?.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    navList?.classList.toggle('is-open');
  });
  navList?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    navList.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }));

  // Active section highlighting on scroll
  const links = Array.from(document.querySelectorAll('.nav__list a'));
  const sections = links
    .map((l) => document.querySelector(l.getAttribute('href')))
    .filter(Boolean);

  const onScroll = () => {
    const scrollY = window.scrollY + 120; // offset for sticky header
    let currentIdx = -1;
    sections.forEach((sec, idx) => {
      const rect = sec.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      if (scrollY >= top) currentIdx = idx;
    });
    links.forEach((l, idx) => l.classList.toggle('is-active', idx === currentIdx));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Track mouse for parallax (both themes)
  window.addEventListener('mousemove', (e) => {
    const w = window.innerWidth || document.documentElement.clientWidth;
    const h = window.innerHeight || document.documentElement.clientHeight;
    mouseNx = Math.min(1, Math.max(0, e.clientX / Math.max(1, w)));
    mouseNy = Math.min(1, Math.max(0, e.clientY / Math.max(1, h)));
  }, { passive: true });

  // Detect CV file existence (works on http/https). On file:// always show the button.
  if (cvButton) {
    const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
    if (isHttp) {
      fetch(cvButton.getAttribute('href'), { method: 'HEAD' })
        .then((res) => {
          if (!res.ok) throw new Error('CV not found');
        })
        .catch(() => {
          // If missing on server, hide gracefully
          cvButton.style.display = 'none';
        });
    }
  }

  // Auto-detect profile photo if user added one (profile.jpg/png or photo.jpg/png)
  const profileImg = document.querySelector('.hero__image img');
  const candidates = [
    'assets/img/profile.jpg',
    'assets/img/profile.png',
    'assets/img/photo.jpg',
    'assets/img/photo.png',
  ];
  if (profileImg) {
    const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
    const tryNext = (idx) => {
      if (idx >= candidates.length) return;
      const url = candidates[idx];
      if (!isHttp) {
        // On file:// on ne peut pas tester proprement; on laisse le placeholder.
        return;
      }
      fetch(url, { method: 'HEAD' })
        .then((res) => {
          if (res.ok) {
            profileImg.src = url;
          } else {
            tryNext(idx + 1);
          }
        })
        .catch(() => tryNext(idx + 1));
    };
    tryNext(0);
  }

  // Simple tilt interaction (no external lib)
  const tiltElements = document.querySelectorAll('[data-tilt]');
  tiltElements.forEach((el) => {
    const strength = 10; // deg
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rx = (py - 0.5) * -strength;
      const ry = (px - 0.5) * strength;
      el.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    const reset = () => { el.style.transform = 'perspective(700px) rotateX(0) rotateY(0)'; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', reset);
    el.addEventListener('touchmove', (e) => {
      if (!e.touches[0]) return;
      const t = e.touches[0];
      onMove(t);
    }, { passive: true });
    el.addEventListener('touchend', reset);
  });

  // Stars & galaxies background
  if (starsCanvas && starsCanvas.getContext) {
    const ctx = starsCanvas.getContext('2d');
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let width = 0, height = 0;

    const stars = [];
    const nebulas = [];
    function isLight() { return document.body.classList.contains('light'); }
    const baseLayers = [
      { depth: 0.25, twMul: 1.0, speed: 0.012 },
      { depth: 0.6,  twMul: 1.4, speed: 0.022 },
      { depth: 1.0,  twMul: 1.8, speed: 0.035 },
    ];
    let layers = JSON.parse(JSON.stringify(baseLayers));
    const meteors = [];

    function resize() {
      width = starsCanvas.clientWidth;
      height = starsCanvas.clientHeight;
      starsCanvas.width = Math.floor(width * DPR);
      starsCanvas.height = Math.floor(height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      initScene();
    }

    function initScene() {
      stars.length = 0;
      nebulas.length = 0;
      // stars by depth layers (reset layers on resize)
      layers = JSON.parse(JSON.stringify(baseLayers));
      const base = Math.floor((width * height) / 5500);
      layers.forEach((layer) => {
        // Dark theme gets a speed boost
        const speedBoost = isLight() ? 1.0 : 1.35;
        layer.speed *= speedBoost;
        layer.twMul *= speedBoost;
        const count = Math.floor(base * (0.6 + layer.depth));
        for (let i = 0; i < count; i++) {
          stars.push({
            layer,
            x: Math.random() * width,
            y: Math.random() * height,
            r: (Math.random() * 1.2 + 0.2) * (0.7 + 0.6 * layer.depth),
            a: Math.random() * 0.6 + 0.2,
            tw: (Math.random() * 0.02 + 0.005) * layer.twMul,
            off: Math.random() * Math.PI * 2,
            vx: (Math.random() - 0.5) * layer.speed,
            vy: (Math.random() - 0.5) * layer.speed,
          });
        }
      });
      meteors.length = 0;
      // Create 2 nebulas (soft color blobs)
      const nebulaCount = 2;
      for (let i = 0; i < nebulaCount; i++) {
        nebulas.push({
          x: Math.random() * width,
          y: Math.random() * height * 0.5,
          r: Math.random() * 300 + 220,
          hue: 200 + Math.random() * 80,
          alpha: 0.12 + Math.random() * 0.08,
        });
      }
    }

    function drawNebulas() {
      nebulas.forEach((n) => {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, `hsla(${n.hue}, 80%, 60%, ${n.alpha})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    let tStar = 0;
    function draw() {
      ctx.clearRect(0, 0, width, height);
      drawNebulas();
      // parallax drift (stronger in dark)
      const darkFactor = isLight() ? 0.9 : 1.4;
      const parallaxX = Math.sin(tStar * 0.00045 * darkFactor) * (18 * darkFactor) + (mouseNx - 0.5) * (24 * darkFactor);
      const parallaxY = Math.cos(tStar * 0.00045 * darkFactor) * (10 * darkFactor) + (mouseNy - 0.5) * (14 * darkFactor);

      ctx.fillStyle = '#ffffff';
      stars.forEach((s) => {
        s.off += s.tw;
        const alpha = s.a * (0.6 + 0.4 * Math.sin(s.off));
        ctx.globalAlpha = alpha;
        const px = s.x + parallaxX * s.layer.depth;
        const py = s.y + parallaxY * s.layer.depth;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -2) s.x = width + 2;
        if (s.x > width + 2) s.x = -2;
        if (s.y < -2) s.y = height + 2;
        if (s.y > height + 2) s.y = -2;
      });

      // meteors disabled (remove trails)
      meteors.length = 0;

      tStar += 16;
      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
  }

  // Mist for light theme (soft moving fog)
  if (mistCanvas && mistCanvas.getContext) {
    const ctx = mistCanvas.getContext('2d');
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let width = 0, height = 0, t = 0;

    function resize() {
      width = mistCanvas.clientWidth;
      height = mistCanvas.clientHeight;
      mistCanvas.width = Math.floor(width * DPR);
      mistCanvas.height = Math.floor(height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function noise(x, y, seed) {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453);
      return n - Math.floor(n);
    }

    // soft blobs fog rendering (animated movement - slow & gentle)
    function drawFogBlobs(timeSeed) {
      const blobCount = 10; // moderate density
      for (let i = 0; i < blobCount; i++) {
        const phase = timeSeed * 0.0002 + i * 0.6; // slow, gentle movement
        const cx = (Math.sin(phase) * 0.25 + 0.5) * width; // subtle horizontal drift
        const cy = height * 0.5 + (Math.cos(phase * 0.9 + i * 0.5) * 0.2 + 0.15) * height; // gentle vertical flow
        const r = Math.max(width, height) * (0.15 + i * 0.03 + Math.sin(phase * 0.7) * 0.02); // soft pulsing
        const alpha = 0.08 + Math.sin(phase * 1.2) * 0.025; // gentle opacity change
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,255,255,${alpha})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // fireflies
    const fireflies = [];
    function initFireflies() {
      fireflies.length = 0;
      const count = Math.max(12, Math.floor((width * height) / 60000));
      for (let i = 0; i < count; i++) {
        fireflies.push({
          x: Math.random() * width,
          y: height * 0.5 + Math.random() * (height * 0.5),
          r: Math.random() * 2 + 1.5,
          a: Math.random() * 0.6 + 0.4,
          ax: (Math.random() - 0.5) * 0.3,
          ay: (Math.random() - 0.5) * 0.2,
          off: Math.random() * Math.PI * 2,
        });
      }
    }

    function draw() {
      if (!document.body.classList.contains('light')) {
        requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, width, height);
      drawFogBlobs(t);
      // fireflies glow
      fireflies.forEach((f) => {
        f.off += 0.02;
        f.x += Math.sin(f.off) * 0.4 + f.ax;
        f.y += Math.cos(f.off * 1.3) * 0.3 + f.ay;
        if (f.x < 0) f.x = width; if (f.x > width) f.x = 0;
        if (f.y < height * 0.5) f.y = height * 0.5; if (f.y > height) f.y = height;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 18);
        const intensity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(f.off * 2));
        g.addColorStop(0, `rgba(255, 255, 200, ${0.6 * intensity})`);
        g.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 18, 0, Math.PI * 2);
        ctx.fill();
      });
      t += 16;
      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    initFireflies();
    draw();
  }

  // Light theme forest parallax (subtle background shift)
  (function initForestParallax() {
    let ticking = false;
    function updateParallax() {
      ticking = false;
      if (!document.body.classList.contains('light')) return;
      const y = window.scrollY || 0;
      const strength = 0.15; // scroll strength
      const mx = (mouseNx - 0.5) * 10; // mouse x sway
      const my = (mouseNy - 0.5) * 6;  // mouse y sway
      document.body.style.backgroundPosition = `calc(50% + ${mx}px) calc(50% + ${-y * strength + my}px)`;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
    window.addEventListener('mousemove', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
    updateParallax();
  })();

  // Contact form handling with EmailJS
  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');
  
  // EmailJS Configuration
  const EMAILJS_CONFIG = {
    publicKey: '9lJCpWDsiyxv5XdDv',      // Your EmailJS Public Key
    serviceId: 'service_cjgkasc',        // Your EmailJS Service ID
    templateId: 'template_303mi36'       // Your EmailJS Template ID
  };
  
  // Initialize EmailJS
  emailjs.init(EMAILJS_CONFIG.publicKey);
  
  if (contactForm && formStatus) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Get form data
      const formData = new FormData(contactForm);
      const name = formData.get('name');
      const email = formData.get('email');
      const subject = formData.get('subject');
      const message = formData.get('message');
      
      // Validate form
      if (!name || !email || !subject || !message) {
        showFormStatus('Veuillez remplir tous les champs requis.', 'error');
        return;
      }
      
      // Show loading state
      showFormStatus('Envoi en cours...', 'loading');
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi...';
      
      try {
        // Send email using EmailJS
        const templateParams = {
          from_name: name,
          from_email: email,
          subject: subject,
          message: message,
          to_email: 'mohamed-yassir.sossey@epitech.eu',
          reply_to: email
        };
        
        const result = await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, templateParams);
        
        if (result.status === 200) {
          showFormStatus('Message envoyé avec succès ! Je vous répondrai rapidement.', 'success');
          contactForm.reset();
          return;
        } else {
          throw new Error('EmailJS send failed');
        }
        
      } catch (error) {
        console.error('EmailJS Error:', error);
        
        // Fallback: Create mailto link and show instructions
        const emailBody = `Bonjour Mohamed Yassir,

Voici un nouveau message depuis votre portfolio :

Nom: ${name}
Email: ${email}
Sujet: ${subject}

Message:
${message}

---
Message envoyé depuis cv-alternance.vercel.app`;

        const mailtoUrl = `mailto:mohamed-yassir.sossey@epitech.eu?subject=${encodeURIComponent(`[Portfolio] ${subject}`)}&body=${encodeURIComponent(emailBody)}`;
        
        // Open email client
        window.open(mailtoUrl, '_blank');
        
        showFormStatus('Message envoyé via votre client email. Merci de votre message !', 'success');
        contactForm.reset();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer le message';
      }
    });
    
    function showFormStatus(message, type) {
      formStatus.textContent = message;
      formStatus.className = `form-status ${type}`;
      
      if (type === 'success' || type === 'error') {
        setTimeout(() => {
          formStatus.textContent = '';
          formStatus.className = 'form-status';
        }, 5000);
      }
    }
  }

  // Copy email functionality
  const copyEmailBtn = document.getElementById('copy-email');
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', async () => {
      const email = 'mohamed-yassir.sossey@epitech.eu';
      try {
        await navigator.clipboard.writeText(email);
        copyEmailBtn.textContent = 'Email copié !';
        setTimeout(() => {
          copyEmailBtn.textContent = 'Email';
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = email;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copyEmailBtn.textContent = 'Email copié !';
        setTimeout(() => {
          copyEmailBtn.textContent = 'Email';
        }, 2000);
      }
    });
  }
})();


