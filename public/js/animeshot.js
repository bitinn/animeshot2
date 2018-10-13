'use strict';

function copyInput (el) {
  el.select();
  document.execCommand('copy');
}