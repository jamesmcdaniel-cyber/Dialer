# Dialer

A simple softphone dialer interface that runs as a pop-up screen in Salesforce, integrated with Salesforce Open CTI and Twilio Voice for real calls.

## What it is

- [index.html](index.html) — the dialer UI, sized for a compact pop-up window (~360×620) and styled to match Salesforce Lightning
- [cti.js](cti.js) — Salesforce Open CTI adapter (click-to-dial, screen pops, call logging)
- [twilio-phone.js](twilio-phone.js) — Twilio Voice adapter (real browser calls via WebRTC)
- [twilio-serverless/](twilio-serverless/) — Twilio Functions for the access token and outbound TwiML
- [vendor/twilio.min.js](vendor/twilio.min.js) — Twilio Voice JS SDK v2.18.3 (vendored; Apache 2.0, see [vendor/TWILIO-LICENSE.md](vendor/TWILIO-LICENSE.md))
- [call-center-definition.xml](call-center-definition.xml) — sample Call Center definition to import into Salesforce

### Features

- Telephone keypad with letter sub-labels, plus direct typing and keyboard shortcuts
- Live formatting of 10-digit US numbers as `(xxx) xxx-xxxx`
- In-call state with pulsing status strip, running timer, and mute / hold / end controls
- **Click-to-dial**: clicking a phone number in Salesforce opens the softphone with the number and record pre-filled
- **Screen pop**: starting a call pops the matching Salesforce record
- **Call logging**: ending a call saves a completed Task (subject, duration, outbound call type) related to the click-to-dial record
- **Real calls**: with Twilio configured, Call places an actual phone call from the browser; the timer starts when the call connects, and Mute mutes the live audio
- Falls back gracefully: without Salesforce it runs standalone; without Twilio it simulates calls. The footer always shows the current state (e.g. `Salesforce connected · phone ready`)

## Salesforce setup

1. **Host the files** — serve `index.html` and `cti.js` from any HTTPS host (or a Visualforce page in your org).
2. **Configure the adapter** — at the top of [cti.js](cti.js), set `instanceUrl` to your org's domain (e.g. `https://yourdomain.lightning.force.com`) if hosted externally; leave it empty if served from your Salesforce domain. Bump `apiVersion` if needed.
3. **Import the call center** — edit `reqAdapterUrl` in [call-center-definition.xml](call-center-definition.xml) to your hosted URL, then in Setup → **Call Centers** → **Import**.
4. **Assign users** — open the imported call center → **Manage Call Center Users** → add your users.
5. **Add the softphone to an app** — Setup → **App Manager** → edit your Lightning app → **Utility Items** → add **Open CTI Softphone**.
6. Phone numbers in Salesforce become clickable; the softphone opens as a pop-up from the utility bar.

## Twilio setup (real calls)

A free [Twilio trial account](https://www.twilio.com/try-twilio) is enough for a demo. Trial limits: outbound calls play a short trial notice first, and you can only call phone numbers verified in your Twilio console.

1. **Create an API key** — Console → Account → API keys & tokens → Create API key. Note the SID and secret.
2. **Create the Functions** — Console → Functions & Assets → Services → Create service (e.g. `dialer`). Add two functions, pasting in [twilio-serverless/token.js](twilio-serverless/token.js) as `/token` and [twilio-serverless/voice.js](twilio-serverless/voice.js) as `/voice`. Set both to public visibility.
3. **Create a TwiML App** — Console → Voice → TwiML Apps → Create. Set the Voice request URL to your deployed `/voice` function URL. Note the TwiML App SID.
4. **Set environment variables** on the Functions service: `API_KEY`, `API_SECRET`, `TWIML_APP_SID`, and `CALLER_ID` (your Twilio number in E.164 format, e.g. `+14155551234`). Make sure "Add my Twilio Credentials (ACCOUNT_SID and AUTH_TOKEN)" is enabled, then deploy.
5. **Point the dialer at it** — at the top of [twilio-phone.js](twilio-phone.js), set `tokenUrl` to your deployed `/token` URL (e.g. `https://dialer-1234.twil.io/token`).

Reload the dialer; the footer should read `phone ready`. The browser will ask for microphone access on the first call. Numbers are normalized to E.164 before dialing (10-digit numbers get `+1`).

The Hold button is visual-only — hold requires conference-based call control, which is beyond this demo.

## Try it standalone

Open `index.html` in a browser, or simulate the pop-up size:

```js
window.open('index.html', 'dialer', 'width=360,height=620');
```

Without Salesforce or Twilio configured, the footer shows `Salesforce not connected · simulated calls` and everything works locally in demo mode.

## How the pieces fit

Open CTI connects the softphone to Salesforce (click-to-dial, screen pops, call logs); Twilio Voice carries the audio. Each is optional and the UI adapts: [index.html](index.html) talks only to the two small adapters (`DialerCTI`, `DialerPhone`), so swapping Twilio for another provider means reimplementing `twilio-phone.js`'s five-method interface, nothing else.
