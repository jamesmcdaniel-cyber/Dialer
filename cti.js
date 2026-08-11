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
  // org's My Domain: 'https://yourdomain.my.salesforce.com'
  instanceUrl: 'https://keyslogic.my.salesforce.com'
};

window.DialerCTI = (function () {
  var connected = false;
  var connectTimer = null;
  var handlers = { onStatusChange: null, onClickToDial: null };

  function log(msg) {
    if (window.console) console.log('[Dialer CTI] ' + msg);
  }

  function setConnected(value) {
    clearTimeout(connectTimer);
    connected = value;
    log(value ? 'Connected to Salesforce' : 'Not connected — running standalone');
    if (handlers.onStatusChange) handlers.onStatusChange(connected);
  }

  // opencti_min.js must come from the org's my.salesforce.com domain;
  // lightning.force.com answers script requests with a login redirect.
  // Try the configured domain first, then the sibling form of it.
  function candidateUrls() {
    var cfg = window.DIALER_CONFIG;
    var path = '/support/api/' + cfg.apiVersion + '/lightning/opencti_min.js';
    var base = (cfg.instanceUrl || '').replace(/\/+$/, '');
    var urls = [base + path];
    if (base.indexOf('.lightning.force.com') !== -1) {
      urls.push(base.replace('.lightning.force.com', '.my.salesforce.com') + path);
    } else if (base.indexOf('.my.salesforce.com') !== -1) {
      urls.push(base.replace('.my.salesforce.com', '.lightning.force.com') + path);
    }
    return urls;
  }

  // Salesforce appends sfdcIframeOrigin and mode to the adapter URL when it
  // renders the softphone iframe. opencti_min.js reads them from
  // location.search and throws on load if either is missing, so check for
  // them first — otherwise the failure surfaces as a silent timeout.
  function softphoneParams() {
    var out = {};
    var query = (window.location.search || '').replace(/^\?/, '');
    if (!query) return out;
    query.split('&').forEach(function (pair) {
      var parts = pair.split('=');
      if (parts[0]) out[parts[0]] = parts[1] ? decodeURIComponent(parts[1]) : '';
    });
    return out;
  }

  function loadScript() {
    var params = softphoneParams();
    if (!params.sfdcIframeOrigin || !params.mode) {
      log('Not running inside a Salesforce softphone: the page URL has no ' +
          'sfdcIframeOrigin/mode parameters (' +
          (window.location.search || 'no query string') + '). ' +
          'Open the dialer from the Salesforce utility bar — a separate ' +
          'browser tab or window can never connect. If it is in the utility ' +
          'bar, check that the Call Center adapter URL matches ' +
          window.location.origin + window.location.pathname);
      setConnected(false);
      return;
    }
    log('Softphone frame detected (origin ' + params.sfdcIframeOrigin +
        ', mode ' + params.mode + ')');

    // If Salesforce never answers the handshake, resolve to standalone
    // instead of hanging.
    connectTimer = setTimeout(function () {
      log('Timed out waiting for the Open CTI handshake');
      setConnected(false);
    }, 10000);

    var urls = candidateUrls();
    (function tryNext(i) {
      if (i >= urls.length) {
        log('Could not load opencti_min.js from any candidate URL');
        setConnected(false);
        return;
      }
      log('Trying ' + urls[i]);
      var script = document.createElement('script');
      script.src = urls[i];
      script.onload = function () {
        if (!window.sforce || !sforce.opencti) {
          log('Script loaded but sforce.opencti is missing (login redirect?)');
          tryNext(i + 1);
          return;
        }
        log('opencti_min.js loaded, starting handshake');
        // sforce.opencti is assigned before initialize() runs, so it exists
        // even when initialization failed; the first API call is what throws.
        try {
          onScriptLoaded();
        } catch (e) {
          log('Open CTI rejected the handshake: ' + (e && e.message ? e.message : e));
          setConnected(false);
        }
      };
      script.onerror = function () {
        log('Failed to load ' + urls[i]);
        tryNext(i + 1);
      };
      document.head.appendChild(script);
    })(0);
  }

  function onScriptLoaded() {
    sforce.opencti.enableClickToDial({
      callback: function (response) {
        if (!response.success) log('enableClickToDial failed: ' + JSON.stringify(response.errors));
        setConnected(response.success);
      }
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
