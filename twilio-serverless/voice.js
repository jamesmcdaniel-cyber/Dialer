/*
 * Twilio Function: /voice
 *
 * TwiML handler for outbound calls from the browser dialer. Set your TwiML
 * App's Voice request URL to this Function's URL. Environment variable:
 *
 *   CALLER_ID — a Twilio number you own (or a verified number), E.164 format
 *
 * The dialer passes the dialed number as the `To` parameter.
 */
exports.handler = function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();

  if (event.To) {
    const dial = twiml.dial({ callerId: context.CALLER_ID });
    dial.number(event.To);
  } else {
    twiml.say('No number was provided.');
  }

  return callback(null, twiml);
};
