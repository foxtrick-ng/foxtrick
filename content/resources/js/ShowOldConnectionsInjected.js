// @ts-nocheck
(function() {
  const id = "ctl00_ctl00_CPContent_CPMain_lnkShowLogins";
  let _dispatched = false;

  if (document.readyState === "complete")
    doPostBack();
  else
    document.addEventListener("readystatechange", doPostBack);

  function doPostBack() {
    if (!_dispatched && document.readyState === "complete") {
      _dispatched = true;
      document.removeEventListener("readystatechange", doPostBack);

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
    }
  }
})();