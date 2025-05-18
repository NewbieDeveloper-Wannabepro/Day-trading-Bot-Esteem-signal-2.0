
  window.addEventListener('load', () => {
    // Ensure the loading screen lasts at least 3 seconds
    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      loader.classList.add('hidden');
    }, 3000); // 3 seconds minimum
  });