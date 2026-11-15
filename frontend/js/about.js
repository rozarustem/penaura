(function() {
  const exploreButton = document.getElementById('btn-about-explore');
  if (!exploreButton) return;

  exploreButton.addEventListener('click', function() {
    window.location.href = 'index.html#discover';
  });
})();
