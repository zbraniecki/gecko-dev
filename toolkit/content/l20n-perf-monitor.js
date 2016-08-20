{
//document.addLayoutStartBlocker();
let winUtils = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIDOMWindowUtils);

let iTransactionId;

document.addEventListener('MozBeforeLayout', function(evt) {
  if (evt.target !== document) return false;
  iTransactionId = winUtils.lastTransactionId;
  performance.mark(`mozBeforeLayout[tID=${iTransactionId}]`);
}, true);

document.onreadystatechange = function () {
  if (document.readyState == "interactive") {
    performance.mark('interactive');
  }
}

function logFirstPaint(event) {
  let afterInteractive = false;
  if (event.transactionId > iTransactionId) {
    afterInteractive = true;
  }
  let info = event.transactionId === iTransactionId ? 'at interactive':
    event.transactionId > iTransactionId ? 'after interactive' : 'before interactive';
  performance.mark(`Paint for tID: ${event.transactionId} (${info})`);
  if (afterInteractive) {
    window.removeEventListener('MozAfterPaint', logFirstPaint, true);
  }
}

  const timingEvents = [
    'domLoading',
    'domInteractive',
    'domContentLoadedEventStart',
    'domContentLoadedEventEnd',
    'domComplete',
    'loadEventStart',
    'loadEventEnd',
  ];

setTimeout(() => {
  console.log('--- Performance.Timing ---');
  console.log(`navigationStart: ${performance.timing.navigationStart}`);
  timingEvents.forEach(eventName => {
    if (performance.timing[eventName]) {
      console.log(`${eventName}: ${performance.timing[eventName] - performance.timing.navigationStart}`);
    }
  });

  console.log('--- Performance.Marks ---');
  let marks = performance.getEntriesByType('mark');
  marks.forEach(mark => {
    console.log(`${mark.startTime}: ${mark.name}`);
  });
}, 1000);

window.addEventListener("MozAfterPaint", logFirstPaint, true);
}
