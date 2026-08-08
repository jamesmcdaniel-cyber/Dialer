/*
 * Salesforce Open CTI adapter for the dialer.
 *
 * Loads opencti_min.js from the Salesforce org hosting the softphone and
 * exposes a small interface on window.DialerCTI:
 *
 *   init({ onStatusChange, onClickToDial })
 *   isConnected()
 *   notifyCallStart(number)          — screen pops the matching record
 *   logCall({ number, seconds, record }, done)
 *
 * When the page is opened outside Salesforce the script fails to load and
 * every method becomes a no-op, so the dialer still works standalone.
 */
window.DIALER_CONFIG = {
  // Open CTI API version to load.
  apiVersion: '62.0',
  // Leave empty when the page is served from your Salesforce domain
  // (e.g. as a Visualforce page). If it's hosted externally, set your
  // org's domain: 'https://yourdomain.lightning.force.com'
  instanceUrl: ''
};

window.DialerCTI = (function () {
  var connected = false;
  var handlers = { onStatusChange: null, onClickToDial: null };

  function setConnected(value) {
    connected = value;
    if (handlers.onStatusChange) handlers.onStatusChange(connected);
  }

  function loadScript() {
    var cfg = window.DIALER_CONFIG;
    var script = document.createElement('script');
    script.src = cfg.instanceUrl + '/support/api/' + cfg.apiVersion + '/lightning/opencti_min.js';
    script.onload = onScriptLoaded;
    script.onerror = function () { setConnected(false); };
    document.head.appendChild(script);
  }

  function onScriptLoaded() {
    if (!(window.sforce && sforce.opencti)) {
      setConnected(false);
      return;
    }

    sforce.opencti.enableClickToDial({
      callback: function (response) { setConnected(response.success); }
    });

    sforce.opencti.onClickToDial({
      listener: function (payload) {
        // Bring the softphone forward and hand the number to the dialer.
        sforce.opencti.setSoftphonePanelVisibility({ visible: true });
        if (handlers.onClickToDial) handlers.onClickToDial(payload);
      }
    });

    sforce.opencti.setSoftphonePanelLabel({ label: 'Phone' });
    sforce.opencti.setSoftphonePanelIcon({ key: 'call' });
  }

  function notifyCallStart(number) {
    if (!connected) return;
    // Pop the record whose phone fields match the dialed number.
    sforce.opencti.searchAndScreenPop({
      searchParams: number,
      queryParams: '',
      deferred: false,
      callType: sforce.opencti.CALL_TYPE.OUTBOUND,
      callback: function () {}
    });
  }

  function logCall(call, done) {
    if (!connected) {
      if (done) done({ success: false, standalone: true });
      return;
    }

    var task = {
      entityApiName: 'Task',
      Subject: 'Call ' + call.number,
      Status: 'Completed',
      TaskSubtype: 'Call',
      CallType: 'Outbound',
      CallDurationInSeconds: call.seconds,
      ActivityDate: new Date().toISOString().slice(0, 10)
    };

    // Relate the log to the record that initiated click-to-dial, if any.
    if (call.record && call.record.recordId) {
      var who = call.record.objectType === 'Contact' || call.record.objectType === 'Lead';
      task[who ? 'WhoId' : 'WhatId'] = call.record.recordId;
    }

    sforce.opencti.saveLog({
      value: task,
      callback: function (response) { if (done) done(response); }
    });
  }

  return {
    init: function (opts) {
      handlers.onStatusChange = opts.onStatusChange || null;
      handlers.onClickToDial = opts.onClickToDial || null;
      loadScript();
    },
    isConnected: function () { return connected; },
    notifyCallStart: notifyCallStart,
    logCall: logCall
  };
})();
