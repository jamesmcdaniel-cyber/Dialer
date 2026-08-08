# Dialer

A simple softphone dialer interface that runs as a pop-up screen in Salesforce, integrated with Salesforce Open CTI.

## What it is

- [index.html](index.html) — the dialer UI, sized for a compact pop-up window (~360×620) and styled to match Salesforce Lightning
- [cti.js](cti.js) — Salesforce Open CTI adapter (click-to-dial, screen pops, call logging)
- [call-center-definition.xml](call-center-definition.xml) — sample Call Center definition to import into Salesforce

### Features

- Telephone keypad with letter sub-labels, plus direct typing and keyboard shortcuts
- Live formatting of 10-digit US numbers as `(xxx) xxx-xxxx`
- In-call state with pulsing status strip, running timer, and mute / hold / end controls
- **Click-to-dial**: clicking a phone number in Salesforce opens the softphone with the number and record pre-filled
- **Screen pop**: starting a call pops the matching Salesforce record
- **Call logging**: ending a call saves a completed Task (subject, duration, outbound call type) related to the click-to-dial record
- Falls back to standalone mode automatically when opened outside Salesforce

## Salesforce setup

1. **Host the files** — serve `index.html` and `cti.js` from any HTTPS host (or a Visualforce page in your org).
2. **Configure the adapter** — at the top of [cti.js](cti.js), set `instanceUrl` to your org's domain (e.g. `https://yourdomain.lightning.force.com`) if hosted externally; leave it empty if served from your Salesforce domain. Bump `apiVersion` if needed.
3. **Import the call center** — edit `reqAdapterUrl` in [call-center-definition.xml](call-center-definition.xml) to your hosted URL, then in Setup → **Call Centers** → **Import**.
4. **Assign users** — open the imported call center → **Manage Call Center Users** → add your users.
5. **Add the softphone to an app** — Setup → **App Manager** → edit your Lightning app → **Utility Items** → add **Open CTI Softphone**.
6. Phone numbers in Salesforce become clickable; the softphone opens as a pop-up from the utility bar.

## Try it standalone

Open `index.html` in a browser, or simulate the pop-up size:

```js
window.open('index.html', 'dialer', 'width=360,height=620');
```

Without Salesforce the footer shows "Standalone" and calls are simulated locally.

## Notes

Open CTI connects the softphone to Salesforce (click-to-dial, screen pops, call logs) but does not carry voice — audio requires a telephony/CTI provider. Wire your provider's SDK into `startCall`/`endCall` in `index.html` alongside the existing `DialerCTI` hooks.
