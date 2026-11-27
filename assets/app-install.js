(()=>{
 const scriptUrl=document.currentScript?.src||location.href;
 const installButton=document.getElementById('installBtn');
 let installPrompt=null;
 const setVisible=visible=>{if(installButton)installButton.hidden=!visible};
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();installPrompt=event;setVisible(true);
 });
 window.addEventListener('appinstalled',()=>{installPrompt=null;setVisible(false)});
 installButton?.addEventListener('click',async()=>{
  if(!installPrompt)return;
  installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;setVisible(false);
 });
 if('serviceWorker'in navigator)window.addEventListener('load',()=>{
  navigator.serviceWorker.register(new URL('../service-worker.js',scriptUrl)).catch(error=>console.warn('Offline cache unavailable',error));
 });
})();
