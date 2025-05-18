// Glow in on scroll
  const footer = document.querySelector('.animated-footer');
  const glow = document.querySelector('.footer-glow');

  const footerObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        footer.classList.add('footer-active');
        glow.style.opacity = '1';
        glow.style.transform = 'translateX(-50%) scale(1.2)';
      } else {
        glow.style.opacity = '0.3';
        glow.style.transform = 'translateX(-50%) scale(1)';
      }
    });
  }, {
    threshold: 0.3
  });

  footerObserver.observe(footer);