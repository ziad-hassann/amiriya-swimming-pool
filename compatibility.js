(function () {
  if (typeof window.TextEncoder !== 'function') {
    window.TextEncoder = function () {};
    window.TextEncoder.prototype.encode = function (text) {
      var encoded = unescape(encodeURIComponent(String(text)));
      var bytes = new Uint8Array(encoded.length);
      for (var index = 0; index < encoded.length; index++) bytes[index] = encoded.charCodeAt(index);
      return bytes;
    };
  }
  var dialogs = document.querySelectorAll('dialog');
  for (var i = 0; i < dialogs.length; i++) {
    if (typeof dialogs[i].showModal === 'function') continue;
    installDialog(dialogs[i]);
  }

  function installDialog(dialog) {
    if (typeof dialog.open !== 'boolean') {
      Object.defineProperty(dialog, 'open', { get: function () { return dialog.hasAttribute('open'); } });
    }
    var backdrop;
    var previousFocus;
    dialog.classList.add('dialog-fallback');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.showModal = function () {
      if (dialog.hasAttribute('open')) return;
      previousFocus = document.activeElement;
      backdrop = document.createElement('div');
      backdrop.className = 'dialog-fallback-backdrop';
      document.body.appendChild(backdrop);
      dialog.setAttribute('open', '');
      document.body.classList.add('has-dialog-fallback');
      document.addEventListener('keydown', onKeyDown);
      var focusTarget = dialog.querySelector('input,button,select,[tabindex]');
      if (focusTarget) focusTarget.focus();
    };
    dialog.close = function () {
      dialog.removeAttribute('open');
      if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      document.body.classList.remove('has-dialog-fallback');
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus) previousFocus.focus();
      dialog.dispatchEvent(new Event('close'));
    };
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        var cancel = new Event('cancel', { cancelable: true });
        if (dialog.dispatchEvent(cancel)) dialog.close();
      }
      if (event.key !== 'Tab') return;
      var items = dialog.querySelectorAll('input:not([disabled]),button:not([disabled]),select:not([disabled]),a[href]');
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
})();
