(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.Feedback=api;})(typeof window!=="undefined"?window:globalThis,()=>{
  function buildMailto(feedback,email,version="0.6.2"){
    const text=String(feedback||"").trim(),recipient=String(email||"").trim();
    if(!text)throw new Error("Bitte schreibe zuerst eine Rückmeldung.");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw new Error("Die Feedback-Adresse ist noch nicht konfiguriert.");
    const subject=`Fish Identifier Beta Feedback – ${version}`;
    const body=`Feedback:\n\n${text}\n\nApp-Version: ${version}`;
    return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return{buildMailto};
});
