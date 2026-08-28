// Forward the GitHub Pages URL to the custom domain.
(function () {
  if (location.hostname === 'connordrew.github.io') {
    location.replace('https://www.connorfranklinmusic.co.uk/' + location.search + location.hash);
  }
})();
