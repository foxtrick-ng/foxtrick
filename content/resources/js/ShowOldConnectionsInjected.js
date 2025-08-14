// @ts-nocheck
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "foxtrick") return;
  if (event.data.action !== "triggerPostback") return;

  const id = event.data.targetId;
  const link = document.getElementById(id);
  
  if (!link) {
    console.warn(`Element with ID ${id} not found.`);
    return;
  }
  if (typeof WebForm_DoPostBackWithOptions !== "function") {
    console.warn("WebForm_DoPostBackWithOptions is not defined.");
    return;
  }

  WebForm_DoPostBackWithOptions(
    new WebForm_PostBackOptions(id, "", true, "", "", false, true)
  );
  link.dispatchEvent(new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window
  }));
});
