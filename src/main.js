/* ═══════════════════════════════════════════
   $DELUSION — Main JS
   "Why not us?"
   ═══════════════════════════════════════════ */

import { playChromaExplosion } from './chromakey.js';

// ── Config ──
const CONFIG = {
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || '0'.repeat(44),
  xTwitterUrl: import.meta.env.VITE_X_TWITTER_URL || 'https://x.com/placeholder',
  get pumpUrl() { return `https://pump.fun/coin/${this.contractAddress}`; },
  get dexScreenerUrl() { return `https://dexscreener.com/solana/${this.contractAddress}`; },
};

// ── DOM refs ──
const phases = {
  splash: document.getElementById('phase-splash'),
  video: document.getElementById('phase-video'),
  main: document.getElementById('phase-main'),
};

const video = document.getElementById('intro-video');
const videoBg = document.getElementById('intro-video-bg');
const bgAudio = document.getElementById('bg-audio');
const btnEnter = document.getElementById('btn-enter');
const btnBuy = document.getElementById('btn-buy');
const btnCopyCA = document.getElementById('btn-copy-ca');
const btnDex = document.getElementById('btn-dex');
const caDisplay = document.getElementById('ca-display');
const footerCA = document.getElementById('footer-ca');
const marketCapEl = document.getElementById('market-cap');
const milestoneMcap = document.getElementById('milestone-mcap');
const dexIframe = document.getElementById('dex-iframe');
const navbar = document.getElementById('navbar');
const navXLink = document.getElementById('nav-x-link');
const navPumpLink = document.getElementById('nav-pump-link');
const footerXLink = document.getElementById('footer-x-link');

// ── Track video availability ──
let videoLoaded = false;
let explosionLoaded = false;

const explosionVideo = document.getElementById('explosion-video');
if (explosionVideo) {
  explosionVideo.addEventListener('loadeddata', () => { explosionLoaded = true; });
  explosionVideo.addEventListener('error', () => { explosionLoaded = false; });
}

video.addEventListener('loadeddata', () => { videoLoaded = true; });
video.addEventListener('error', () => { videoLoaded = false; });

// ── Scroll video fallback ──
const scrollVideo = document.getElementById('scroll-video');
const scrollVideoFallback = document.getElementById('scroll-video-fallback');
if (scrollVideo) {
  scrollVideo.addEventListener('error', () => {
    scrollVideo.style.display = 'none';
    if (scrollVideoFallback) scrollVideoFallback.style.display = 'block';
  });
  // Also check if source is missing after a moment
  setTimeout(() => {
    if (scrollVideo.networkState === 3 || scrollVideo.error) {
      scrollVideo.style.display = 'none';
      if (scrollVideoFallback) scrollVideoFallback.style.display = 'block';
    }
  }, 1000);
}

// ── Phase State Machine ──
function goToPhase(name) {
  Object.values(phases).forEach(el => el.classList.remove('active'));
  phases[name].classList.add('active');
  document.body.style.overflow = name === 'main' ? '' : 'hidden';
}

// ── Splash → Video → Main ──
function fadeToMain() {
  phases.video.classList.add('fade-out');

  // Only play explosion if the video loaded
  if (explosionLoaded) {
    playChromaExplosion();
  }

  setTimeout(() => {
    bgAudio.appendChild(video);
    video.style.display = 'none';
    videoBg.pause();
    phases.video.classList.remove('active', 'fade-out');
    phases.main.classList.add('active');
    document.body.style.overflow = '';
    runHeroTypewriter();
  }, 1500);
}

// ── Skip directly to main (no video) ──
function fadeDirectToMain() {
  phases.splash.style.transition = 'opacity 0.8s ease, visibility 0.8s ease';
  phases.splash.classList.remove('active');
  setTimeout(() => {
    phases.main.classList.add('active');
    document.body.style.overflow = '';
    runHeroTypewriter();
  }, 800);
}

btnEnter.addEventListener('click', () => {
  // If video didn't load, skip directly to main
  if (!videoLoaded) {
    fadeDirectToMain();
    return;
  }

  goToPhase('video');

  try {
    videoBg.currentTime = 0;
    videoBg.play().catch(() => {});
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        goToPhase('main');
        runHeroTypewriter();
        return;
      });
    }
    setTimeout(fadeToMain, 11000);
  } catch {
    goToPhase('main');
    runHeroTypewriter();
  }
});

video.addEventListener('ended', () => {
  if (!phases.main.classList.contains('active')) {
    fadeToMain();
  }
});

// ── Wire up links ──
btnBuy.href = CONFIG.pumpUrl;
btnDex.href = CONFIG.dexScreenerUrl;
navPumpLink.href = CONFIG.pumpUrl;
navXLink.href = CONFIG.xTwitterUrl;
footerXLink.href = CONFIG.xTwitterUrl;
caDisplay.textContent = CONFIG.contractAddress;
footerCA.textContent = CONFIG.contractAddress;

// ── DexScreener embed ──
const dexPlaceholder = document.getElementById('dex-placeholder');
if (CONFIG.contractAddress && CONFIG.contractAddress !== '0'.repeat(44)) {
  dexIframe.src = `https://dexscreener.com/solana/${CONFIG.contractAddress}?embed=1&theme=dark&info=0`;
  dexIframe.classList.remove('dex-iframe-hidden');
  dexPlaceholder.style.display = 'none';
}

// ── Copy CA ──
btnCopyCA.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(CONFIG.contractAddress);
    btnCopyCA.textContent = 'Copied!';
    btnCopyCA.classList.add('copied');
    setTimeout(() => {
      btnCopyCA.textContent = 'Copy CA';
      btnCopyCA.classList.remove('copied');
    }, 2000);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = CONFIG.contractAddress;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btnCopyCA.textContent = 'Copied!';
    btnCopyCA.classList.add('copied');
    setTimeout(() => {
      btnCopyCA.textContent = 'Copy CA';
      btnCopyCA.classList.remove('copied');
    }, 2000);
  }
});

// ── Milestone market cap ──
function updateMilestoneMcap(mcap) {
  milestoneMcap.textContent = '$' + mcap.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ── Market Cap from DexScreener ──
async function fetchMarketCap() {
  try {
    const ca = CONFIG.contractAddress;
    if (!ca || ca === '0'.repeat(44)) {
      marketCapEl.textContent = '$\u2014';
      return;
    }
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`);
    const data = await res.json();
    const pair = data.pairs?.[0];
    const mcapRaw = pair?.marketCap ?? pair?.fdv ?? 0;
    const mcap = Number(mcapRaw);
    if (mcap > 0) {
      const formatted = '$' + mcap.toLocaleString('en-US', { maximumFractionDigits: 0 });
      marketCapEl.textContent = formatted;
      updateMilestoneMcap(mcap);
    } else {
      marketCapEl.textContent = '$\u2014';
      updateMilestoneMcap(0);
    }
  } catch {
    marketCapEl.textContent = '$\u2014';
  }
}

fetchMarketCap();
setInterval(fetchMarketCap, 30_000);

// ── Navbar scroll shadow ──
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 10);
});

// ── Typewriter ──
function typeWriter(element, text, speed) {
  return new Promise(resolve => {
    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    element.appendChild(cursor);
    function tick() {
      if (i < text.length) {
        element.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
        setTimeout(tick, speed);
      } else {
        resolve(cursor);
      }
    }
    tick();
  });
}

async function runSplashTypewriter() {
  const line1 = document.getElementById('line1');
  const line2 = document.getElementById('line2');
  const cursor1 = await typeWriter(line1, 'Why not us?', 60);
  cursor1.remove();
  await new Promise(r => setTimeout(r, 300));
  const cursor2 = await typeWriter(line2, 'Be $Delusion-al.', 60);
  // Keep cursor blinking on line2, show button
  btnEnter.classList.remove('hidden');
  btnEnter.classList.add('visible');
}

runSplashTypewriter();

// ── Hero typewriter ──
let heroTyped = false;
async function runHeroTypewriter() {
  if (heroTyped) return;
  heroTyped = true;
  const heroTitle = document.getElementById('hero-title');
  const cursor = await typeWriter(heroTitle, '$DELUSION', 80);
  cursor.remove();
  // Set data-text for CSS glitch effect
  heroTitle.setAttribute('data-text', '$DELUSION');
  // Fade in tagline, buttons, CA
  document.querySelectorAll('.hero-fade').forEach(el => el.classList.add('visible'));
}

// ── Init ──
document.body.style.overflow = 'hidden';
