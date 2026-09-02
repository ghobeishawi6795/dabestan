// PWA Install Handler
(function() {
  let deferredPrompt = null;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });
  
  function showInstallButton() {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem('pwa_install_dismissed')) return;
    
    let btn = document.getElementById('installPwaBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'installPwaBtn';
      btn.innerHTML = '📲 نصب اپ';
      btn.style.cssText = 'position:fixed; bottom:90px; left:50%; transform:translateX(-50%); background:#3F7A52; color:#fff; border:none; border-radius:999px; padding:12px 24px; font-weight:800; cursor:pointer; z-index:200; box-shadow:0 4px 16px rgba(0,0,0,.25); font-family:inherit; font-size:.9rem; animation:popIn .4s both;';
      btn.onclick = doInstall;
      
      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'position:absolute; top:-8px; right:-8px; background:#e2725b; color:#fff; border:none; border-radius:50%; width:24px; height:24px; font-size:.8rem; cursor:pointer;';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        btn.style.display = 'none';
        localStorage.setItem('pwa_install_dismissed', '1');
      };
      btn.appendChild(closeBtn);
      
      document.body.appendChild(btn);
    }
    btn.style.display = 'block';
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (btn && btn.style.display !== 'none') {
        btn.style.opacity = '0';
        setTimeout(() => { if(btn) btn.style.display = 'none'; }, 300);
      }
    }, 10000);
  }
  
  async function doInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    const btn = document.getElementById('installPwaBtn');
    if (btn) btn.style.display = 'none';
  }
  
  window.doInstall = doInstall;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = '@keyframes popIn { from { opacity:0; transform:translateX(-50%) translateY(20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }';
  document.head.appendChild(style);
})();
