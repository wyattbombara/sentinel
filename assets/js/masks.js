/* The supplied Sentinel logo, with shape and color cues for each severity. */
(function (root) {
  'use strict';

  var COLORS = { yellow: '#f5c542', orange: '#f08a24', red: '#e5484d', green: '#4cb782', clear: '#4cb782' };
  var NAMES = { scam: 'Scam', virus: 'Virus', malware: 'Malware' };
  var MATRICES = {
    yellow: '.245 .825 .083 0 0 .197 .663 .067 0 0 .066 .222 .022 0 0 0 0 0 1 0',
    orange: '.240 .808 .082 0 0 .138 .464 .047 0 0 .036 .121 .012 0 0 0 0 0 1 0',
    red: '.229 .771 .078 0 0 .072 .242 .024 0 0 .077 .259 .026 0 0 0 0 0 1 0',
    green: '.076 .256 .026 0 0 .183 .616 .062 0 0 .130 .438 .044 0 0 0 0 0 1 0'
  };
  // Added as vector details so the original PNG stays intact and is cached once.
  var DETAILS = {
    orange: '<path d="M21.8 23.8 17.3 20.4 19.8 29.2 23.1 30.4M41.1 23.8 45.6 20.4 43.1 29.2 39.8 30.4" fill="currentColor"/>' +
      '<path d="m25.2 28.7 4.5 1.8m9.1-1.8-4.5 1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>',
    red: '<path d="M24.8 22.9C18.1 22.4 15.4 16.2 16.7 9.9c2.2 4.2 4.5 6.2 10.7 7.1ZM39.2 22.9c6.7-.5 9.4-6.7 8.1-13-2.2 4.2-4.5 6.2-10.7 7.1Z" fill="currentColor"/>'
  };
  var sequence = 0;
  var logo = typeof document !== 'undefined' && document.currentScript
    ? new URL('../img/sentinel.png', document.currentScript.src).href
    : 'assets/img/sentinel.png';

  function svg(threat, attrs, severity) {
    var tone = severity === 'clear' ? 'green' : severity;
    var filtered = Object.prototype.hasOwnProperty.call(MATRICES, tone);
    var id = 'sentinel-mark-' + (++sequence);
    var defs = filtered ? '<defs><filter id="' + id + '" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="' + MATRICES[tone] + '"/></filter></defs>' : '';
    var variant = tone === 'red' ? 'horned' : tone === 'orange' ? 'angular' : 'normal';
    return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-icon-variant="' + variant + '" ' + (attrs || '') + '>' + defs +
      '<image href="' + logo + '" width="64" height="64"' + (filtered ? ' filter="url(#' + id + ')"' : '') + '/>' +
      '<g style="color:' + (COLORS[tone] || '#d4ae63') + '">' + (DETAILS[tone] || '') + '</g></svg>';
  }

  function paint(scope) {
    scope.querySelectorAll('[data-glyph]').forEach(function (el) {
      var card = el.closest('[data-severity]');
      var tone = card ? card.dataset.severity : ['red', 'orange', 'yellow'].find(function (color) { return el.classList.contains('m--' + color); });
      el.innerHTML = svg(el.dataset.glyph, '', tone);
    });
  }

  root.SentinelMasks = { svg: svg, paint: paint, COLORS: COLORS, NAMES: NAMES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
