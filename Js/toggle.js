const toggle = document.getElementById('theme-switch');
  const label = document.getElementById('theme-label');
  const body = document.body;

  // Load saved theme from localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
    toggle.checked = true;
    label.textContent = 'Dark Mode';
  } else {
    body.classList.remove('dark-mode');
    toggle.checked = false;
    label.textContent = 'Light Mode';
  }

  // Listen for toggle change
  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      body.classList.add('dark-mode');
      label.textContent = 'Dark Mode';
      localStorage.setItem('theme', 'dark');
    } else {
      body.classList.remove('dark-mode');
      label.textContent = 'Light Mode';
      localStorage.setItem('theme', 'light');
    }
  });