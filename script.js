const headerOffset = () => document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0;
const smoothScrollTo = (target) => {
  const start = window.scrollY;
  const end = Math.max(0, target.getBoundingClientRect().top + start - headerOffset() - 18);
  const distance = end - start;
  const duration = Math.min(1250, Math.max(720, Math.abs(distance) * .55));
  const startTime = performance.now();
  const ease = (progress) => 1 - Math.pow(1 - progress, 4);

  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    window.scrollTo(0, start + distance * ease(progress));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const destination = document.querySelector(link.getAttribute('href'));
    if (!destination) return;
    event.preventDefault();
    smoothScrollTo(destination);
  });
});

let wheelTarget = window.scrollY;
let wheelFrame = null;
const smoothWheel = () => {
  const current = window.scrollY;
  const remaining = wheelTarget - current;
  if (Math.abs(remaining) < .6) {
    window.scrollTo(0, wheelTarget);
    wheelFrame = null;
    return;
  }
  window.scrollTo(0, current + remaining * .14);
  wheelFrame = requestAnimationFrame(smoothWheel);
};

window.addEventListener('wheel', (event) => {
  if (event.ctrlKey || event.metaKey || event.shiftKey) return;
  event.preventDefault();
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  wheelTarget = Math.max(0, Math.min(maxScroll, (wheelFrame ? wheelTarget : window.scrollY) + event.deltaY * .9));
  if (!wheelFrame) wheelFrame = requestAnimationFrame(smoothWheel);
}, { passive: false });

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('motion-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .14, rootMargin: '0px 0px -44px' });

  document.querySelectorAll('.intro, .how-heading, .steps, .how-detail, .program-guide, .rsvp-section, .faq').forEach((element, index) => {
    element.style.setProperty('--motion-delay', `${Math.min((index % 3) * 75, 150)}ms`);
    element.classList.add('motion-ready');
    observer.observe(element);
  });
}
