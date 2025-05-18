const toggleBtn = document.getElementById('menu-toggle');
const sidebar = document.getElementById('mobile-menu');
const closeBtn = document.getElementById('close-sidebar');

// Open sidebar
toggleBtn.addEventListener('click', () => {
  sidebar.classList.add('active');
  document.body.classList.add('sidebar-open');
});

// Close button inside sidebar
closeBtn.addEventListener('click', () => {
  sidebar.classList.remove('active');
  document.body.classList.remove('sidebar-open');
});

// Close on link click inside sidebar
sidebar.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  });
});

// Close sidebar when clicking outside of it
document.addEventListener('click', (e) => {
  if (
    sidebar.classList.contains('active') &&
    !sidebar.contains(e.target) &&
    !toggleBtn.contains(e.target)
  ) {
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }
});
