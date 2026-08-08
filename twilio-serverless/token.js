/*
 * Twilio Function: /token
 *
 * Issues a Voice access token for the browser dialer. Create this as a
 * Function in the Twilio Console (Functions & Assets → Services) and set
 * these environment variables on the service:
 *
 *   API_KEY        — API key SID (create under Account → API keys & tokens)
 *   API_SECRET     — the matching API key secret
 *   TWIML_APP_SID  — SID of the TwiML App whose voice URL points at /voice
 *
 * ACCOUNT_SID is provided automatically by the Functions runtime.
 */
exports.handler = function (context, event, callback) {
  const AccessToken = Twilio.jwt.AccessToken;

  const token = new AccessToken(
    context.ACCOUNT_SID,
    context.API_KEY,
    context.API_SECRET,
    { identity: 'dialer-user', ttl: 3600 }
  );

  token.addGrant(new AccessToken.VoiceGrant({
    outgoingApplicationSid: context.TWIML_APP_SID
  }));

  const response = new Twilio.Response();
  // The dialer is served from another origin (your softphone host), so the
  // token endpoint must allow cross-origin requests. Lock this down to your
  // softphone's origin for anything beyond a demo.
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Content-Type', 'application/json');
  response.setBody({ token: token.toJwt() });

  return callback(null, response);
};
