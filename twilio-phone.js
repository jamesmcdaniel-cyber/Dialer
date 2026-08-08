/*
 * Twilio Voice adapter for the dialer.
 *
 * Uses the vendored Twilio Voice JS SDK (vendor/twilio.min.js) to place real
 * calls from the browser. Exposes a small interface on window.DialerPhone:
 *
 *   init({ onReady, onDialing, onAccept, onDisconnect, onError })
 *   isEnabled()                — true once a Device is ready
 *   connect(number)            — place an outbound call
 *   disconnect()               — hang up the active call
 *   setMute(shouldMute)        — mute/unmute the active call
 *
 * With no tokenUrl configured (or if setup fails), isEnabled() stays false
 * and the dialer falls back to simulated calls.
 */
window.TWILIO_CONFIG = {
  // URL of your access-token endpoint (e.g. a Twilio Function, see
  // twilio-serverless/token.js). Empty = simulated calls, no audio.
  tokenUrl: ''
};

window.DialerPhone = (function () {
  var device = null;
  var activeCall = null;
  var handlers = {};

  function emit(name, arg) {
    if (handlers[name]) handlers[name](arg);
  }

  function fetchToken() {
    return fetch(window.TWILIO_CONFIG.tokenUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('Token endpoint returned ' + res.status);
        return res.json();
      })
      .then(function (data) { return data.token; });
  }

  function setup() {
    fetchToken()
      .then(function (token) {
        device = new Twilio.Device(token, {
          codecPreferences: ['opus', 'pcmu']
        });

        device.on('error', function (error) {
          emit('onError', error.message || 'Phone error ' + error.code);
        });

        // Refresh the access token shortly before it expires.
        device.on('tokenWillExpire', function () {
          fetchToken().then(function (token) { device.updateToken(token); });
        });

        emit('onReady');
      })
      .catch(function (err) {
        device = null;
        emit('onError', 'Could not connect to Twilio: ' + err.message);
      });
  }

  function connect(number) {
    emit('onDialing');
    device.connect({ params: { To: number } }).then(function (call) {
      activeCall = call;
      call.on('accept', function () { emit('onAccept'); });
      call.on('disconnect', function () {
        activeCall = null;
        emit('onDisconnect');
      });
      call.on('cancel', function () {
        activeCall = null;
        emit('onDisconnect');
      });
      call.on('error', function (error) {
        activeCall = null;
        emit('onError', error.message || 'Call error ' + error.code);
        emit('onDisconnect');
      });
    }).catch(function (err) {
      emit('onError', 'Call failed: ' + err.message);
      emit('onDisconnect');
    });
  }

  return {
    init: function (opts) {
      handlers = opts || {};
      if (window.TWILIO_CONFIG.tokenUrl && window.Twilio) setup();
    },
    isEnabled: function () { return !!device; },
    connect: connect,
    disconnect: function () {
      if (activeCall) activeCall.disconnect();
      else if (device) device.disconnectAll();
    },
    setMute: function (shouldMute) {
      if (activeCall) activeCall.mute(shouldMute);
    }
  };
})();
